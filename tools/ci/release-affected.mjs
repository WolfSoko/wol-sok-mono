// Selects what a release deploys (#2888): the projects Nx calls affected whose
// task (`deploy`, or `build` for a published package) reads a changed file.
//
// Nx counts a project affected when a changed file is an input of any of its
// targets, so a lint-only root config (`.oxlintrc.json` for `lint`,
// `eslint.config.mjs` for `lint-templates`) made every app affected. Nx's list
// stays the start: it maps the lockfile, root `package.json`,
// `tsconfig.base.json` and `nx.json` to the projects they touch, which a file
// list cannot. The filter only drops a candidate whose task reads none of the
// changed files, and keeps every candidate where it cannot judge.
//
//   node tools/ci/release-affected.mjs --base=<ref> --head=<ref> \
//     --target=deploy [--exclude=<pattern>] [--projects=<pattern>]
//   node tools/ci/release-affected.mjs --files=<file,...> --target=deploy ...
//
// Prints the selected projects, one a line; why each candidate was kept or
// dropped goes to stderr.
import { execFileSync } from 'node:child_process';
import {
  closeSync,
  existsSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

/** Root files whose effect Nx resolves to npm packages, not to files. */
export const NX_VERDICT_FILES = ['package.json', 'package-lock.json'];

const TSCONFIG_BASE = 'tsconfig.base.json';

/**
 * What a change to `tsconfig.base.json` touches. Nx hashes the file into
 * every task, but a change to `compilerOptions.paths` alone matters only
 * through the files its aliases point to: those of every alias added, removed
 * or retargeted, old and new. Any other change touches the file itself.
 *
 * @param {object} before the file's JSON at the base
 * @param {object} after the file's JSON at the head
 * @returns {string[]} the files that count as changed
 */
export function tsconfigBaseChanges(before, after) {
  const pathsBefore = before.compilerOptions?.paths ?? {};
  const pathsAfter = after.compilerOptions?.paths ?? {};
  if (!sameJson(withoutPaths(before), withoutPaths(after))) {
    return [TSCONFIG_BASE];
  }
  const aliases = new Set([
    ...Object.keys(pathsBefore),
    ...Object.keys(pathsAfter),
  ]);
  const targets = [...aliases]
    .filter((alias) => !sameJson(pathsBefore[alias], pathsAfter[alias]))
    .flatMap((alias) => [
      ...(pathsBefore[alias] ?? []),
      ...(pathsAfter[alias] ?? []),
    ])
    .map((target) => target.replace(/^\.\//, ''));
  return [...new Set(targets)];
}

function withoutPaths(tsconfig) {
  const { paths: _paths, ...compilerOptions } = tsconfig.compilerOptions ?? {};
  return { ...tsconfig, compilerOptions };
}

/**
 * Whether a project's `package.json` changed in its `version` only, as the
 * release commit bumps a published package. An app bundles the package's
 * sources through its path alias, so the bump changes nothing it deploys;
 * the npm leg still publishes the new version.
 */
export function isVersionBumpOnly(before, after) {
  return (
    before.version !== after.version &&
    sameJson(
      { ...before, version: undefined },
      { ...after, version: undefined }
    )
  );
}

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * @param {object} release
 * @param {string[]} release.candidates projects Nx calls affected
 * @param {string[]} release.changedFiles files changed and present at the head
 * @param {string[]} release.deletedFiles files gone at the head
 * @param {(project: string) => Set<string> | undefined} release.inputsOf the
 *   files the project's task reads, `undefined` where they could not be read
 * @returns {{ selected: string[], reasons: Record<string, string> }}
 */
export function selectReleaseAffected({
  candidates,
  changedFiles,
  deletedFiles,
  inputsOf,
}) {
  const nxVerdict = nxVerdictReason(changedFiles, deletedFiles);
  const reasons = Object.fromEntries(
    candidates.map((project) => [
      project,
      nxVerdict ?? inputReason(inputsOf(project), changedFiles),
    ])
  );
  const selected = candidates.filter((project) => reasons[project] !== DROPPED);
  return { selected, reasons };
}

const DROPPED = 'reads none of the changed files';

function nxVerdictReason(changedFiles, deletedFiles) {
  const npmFile = changedFiles.find((file) => NX_VERDICT_FILES.includes(file));
  if (npmFile) return `Nx's verdict: ${npmFile} changed`;
  if (deletedFiles.length > 0) {
    return `Nx's verdict: ${deletedFiles[0]} was deleted`;
  }
  return undefined;
}

function inputReason(inputs, changedFiles) {
  if (!inputs) return "Nx's verdict: its inputs could not be read";
  const read = changedFiles.find((file) => inputs.has(file));
  return read ? `reads ${read}` : DROPPED;
}

// --- CLI --------------------------------------------------------------------

const ROOT = join(import.meta.dirname, '..', '..');

function readOptions() {
  const { values } = parseArgs({
    options: {
      base: { type: 'string' },
      head: { type: 'string' },
      files: { type: 'string' },
      target: { type: 'string' },
      exclude: { type: 'string' },
      projects: { type: 'string' },
    },
  });
  if (!values.target) throw new Error('--target is required');
  if (!values.files && !(values.base && values.head)) {
    throw new Error('--files or both --base and --head are required');
  }
  return values;
}

/**
 * Runs Nx with its stdout in a file: piped, `nx show` cuts it off at 64 KiB.
 */
function nxJson(args) {
  const dir = mkdtempSync(join(tmpdir(), 'release-affected-'));
  const file = join(dir, 'out.json');
  const out = openSync(file, 'w');
  try {
    execFileSync('npx', ['nx', ...args, '--json'], {
      cwd: ROOT,
      stdio: ['ignore', out, 'inherit'],
    });
    return JSON.parse(readFileSync(file, 'utf8'));
  } finally {
    closeSync(out);
    rmSync(dir, { recursive: true, force: true });
  }
}

function changesOf({ base, head, files, target }) {
  if (files) {
    const listed = files.split(',').filter((file) => file !== '');
    return {
      changedFiles: listed.filter((file) => existsSync(join(ROOT, file))),
      deletedFiles: listed.filter((file) => !existsSync(join(ROOT, file))),
    };
  }
  const lines = execFileSync(
    'git',
    ['diff', '--name-status', '--no-renames', base, head],
    { cwd: ROOT, encoding: 'utf8' }
  )
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => line.split('\t'));
  const changed = lines
    .filter(([status]) => status !== 'D')
    .map(([, file]) => file);
  return {
    changedFiles: refineChanges(changed, { base, head, target }),
    deletedFiles: lines
      .filter(([status]) => status === 'D')
      .map(([, file]) => file),
  };
}

function refineChanges(changed, { base, head, target }) {
  const jsonAt = (ref, file) =>
    JSON.parse(
      execFileSync('git', ['show', `${ref}:${file}`], {
        cwd: ROOT,
        encoding: 'utf8',
      })
    );
  const existedAtBase = (file) => {
    try {
      execFileSync('git', ['cat-file', '-e', `${base}:${file}`], {
        cwd: ROOT,
        stdio: 'ignore',
      });
      return true;
    } catch {
      return false;
    }
  };
  return changed.flatMap((file) => {
    if (!existedAtBase(file)) return [file];
    if (file === TSCONFIG_BASE) {
      return tsconfigBaseChanges(jsonAt(base, file), jsonAt(head, file));
    }
    const projectPackage =
      target === 'deploy' &&
      file.endsWith('/package.json') &&
      isVersionBumpOnly(jsonAt(base, file), jsonAt(head, file));
    return projectPackage ? [] : [file];
  });
}

function candidatesOf({ base, head, files, target, exclude, projects }) {
  const range = files
    ? [`--files=${files}`]
    : [`--base=${base}`, `--head=${head}`];
  return nxJson([
    'show',
    'projects',
    '--affected',
    ...range,
    `--withTarget=${target}`,
    ...(exclude ? [`--exclude=${exclude}`] : []),
    ...(projects ? [`--projects=${projects}`] : []),
  ]);
}

function inputsReader(target) {
  return (project) => {
    try {
      return new Set(
        nxJson(['show', 'target', 'inputs', `${project}:${target}`]).files
      );
    } catch (error) {
      console.error(
        `${project}: could not read the inputs of ${target}: ${error.message}`
      );
      return undefined;
    }
  };
}

function main() {
  const options = readOptions();
  const { selected, reasons } = selectReleaseAffected({
    candidates: candidatesOf(options),
    ...changesOf(options),
    inputsOf: inputsReader(options.target),
  });
  for (const [project, reason] of Object.entries(reasons)) {
    const verdict = selected.includes(project) ? 'kept' : 'dropped';
    console.error(`${verdict} ${project}: ${reason}`);
  }
  for (const project of selected) console.log(project);
}

if (import.meta.filename === process.argv[1]) main();
