// Selects what a release deploys (#2888): the projects Nx calls affected whose
// task (`deploy`, or `build` for a published package) reads a changed file.
//
// Nx counts a project affected when a changed file is an input of any of its
// targets, so a lint-only root config (`.oxlintrc.json` for `lint`,
// `eslint.config.mjs` for `lint-templates`) made every app affected. Nx's list
// stays the start: it maps the lockfile, root `package.json`,
// `tsconfig.base.json` and `nx.json` to the projects they touch, which a file
// list cannot, so a change to one of them keeps its verdict. A deleted file
// counts for the candidates reading files of the project it lay in (#3054);
// one outside every project keeps Nx's verdict. The filter only drops a
// candidate whose task reads none of the changed files, and keeps every
// candidate where it cannot judge.
//
//   node tools/ci/release-affected.mjs --base=<ref> --head=<ref> \
//     --target=deploy [--exclude=<pattern>] [--projects=<pattern>]
//   node tools/ci/release-affected.mjs --files=<file,...> --target=deploy ...
//
// Prints the selected projects, one a line; why each candidate was kept or
// dropped goes to stderr.
import { execFile, spawn } from 'node:child_process';
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
import { parseArgs, promisify } from 'node:util';

const TSCONFIG_BASE = 'tsconfig.base.json';

/**
 * Root files that keep Nx's verdict: Nx resolves the lockfile and root
 * `package.json` to npm packages, not to files; `nx.json` configures every
 * task; and a root `tsconfig*.json` reaches a task through a project tsconfig
 * extending it, which no task declares. `tsconfig.base.json` reaches here
 * only where `tsconfigBaseChanges` could not narrow its change to files.
 */
export function keepsNxVerdict(file) {
  return (
    file === 'package.json' ||
    file === 'package-lock.json' ||
    file === 'nx.json' ||
    /^tsconfig(\.[^/]+)?\.json$/.test(file)
  );
}

/**
 * What a change to `tsconfig.base.json` touches. Nx hashes the file into
 * every task, but a change to `compilerOptions.paths` alone matters only
 * through the files its aliases point to: those of every alias added, removed
 * or retargeted, old and new. Any other change touches the file itself, as
 * does one of a wildcard alias or target (holding a `*`), which names no
 * file literally.
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
  const changed = [...aliases].filter(
    (alias) => !sameJson(pathsBefore[alias], pathsAfter[alias])
  );
  const targets = changed.flatMap((alias) => [
    ...(pathsBefore[alias] ?? []),
    ...(pathsAfter[alias] ?? []),
  ]);
  if (changed.some(isWildcard) || targets.some(isWildcard)) {
    return [TSCONFIG_BASE];
  }
  return [...new Set(targets.map((target) => target.replace(/^\.\//, '')))];
}

function isWildcard(aliasOrTarget) {
  return aliasOrTarget.includes('*');
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
 * The root of the project a file lies in: the longest project root holding
 * it up to a `/`. The root project (`.`) owns nothing, else every file would
 * have an owner.
 *
 * @param {string} file a path relative to the workspace root
 * @param {Iterable<string>} roots every project's root
 * @returns {string | undefined}
 */
export function ownerRoot(file, roots) {
  let owner;
  for (const root of roots) {
    if (root === '.' || !file.startsWith(`${root}/`)) continue;
    if (!owner || root.length > owner.length) owner = root;
  }
  return owner;
}

/**
 * @param {object} release
 * @param {string[]} release.candidates projects Nx calls affected
 * @param {string[]} release.changedFiles files changed and present at the head
 * @param {string[]} release.deletedFiles files gone at the head
 * @param {(project: string) => Set<string> | undefined} release.inputsOf the
 *   files the project's task and the tasks it depends on read, `undefined`
 *   where they could not be read
 * @param {Record<string, string>} [release.projectRoots] every project's root
 *   at the head, `undefined` where they could not be read; needed only with
 *   deleted files
 * @returns {{ selected: string[], reasons: Record<string, string> }}
 */
export function selectReleaseAffected({
  candidates,
  changedFiles,
  deletedFiles,
  inputsOf,
  projectRoots,
}) {
  const deletions = placeDeletions(deletedFiles, projectRoots);
  const nxVerdict = nxVerdictReason(changedFiles, deletions);
  const reasons = Object.fromEntries(
    candidates.map((project) => [
      project,
      nxVerdict ?? inputReason(inputsOf(project), changedFiles, deletions),
    ])
  );
  const selected = candidates.filter((project) => reasons[project] !== DROPPED);
  return { selected, reasons };
}

const DROPPED = 'reads none of the changed files';

/**
 * Each deleted file with the root of the project it lay in: a deleted file
 * is in no input set, but a task whose inputs reach into its project would
 * have read it. `owner` stays `undefined` without the roots.
 */
function placeDeletions(deletedFiles, projectRoots) {
  const roots = projectRoots ? Object.values(projectRoots) : undefined;
  return deletedFiles.map((file) => ({
    file,
    owner: roots && ownerRoot(file, roots),
  }));
}

function nxVerdictReason(changedFiles, deletions) {
  const rootFile = changedFiles.find(keepsNxVerdict);
  if (rootFile) return `Nx's verdict: ${rootFile} changed`;
  const unplaced = deletions.find(({ owner }) => !owner);
  if (unplaced) return `Nx's verdict: ${unplaced.file} was deleted`;
  return undefined;
}

function inputReason(inputs, changedFiles, deletions) {
  if (!inputs) return "Nx's verdict: its inputs could not be read";
  const read = changedFiles.find((file) => inputs.has(file));
  if (read) return `reads ${read}`;
  const deletion = deletions.find(({ owner }) =>
    readsUnder(inputs, `${owner}/`)
  );
  return deletion
    ? `reads ${deletion.owner}/, where ${deletion.file} was deleted`
    : DROPPED;
}

function readsUnder(inputs, prefix) {
  for (const file of inputs) if (file.startsWith(prefix)) return true;
  return false;
}

// --- CLI --------------------------------------------------------------------

const ROOT = join(import.meta.dirname, '..', '..');
const execFileAsync = promisify(execFile);
/** How many `nx show target inputs` run at once. */
const PARALLEL_READS = 4;

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
async function nxJson(args) {
  const dir = mkdtempSync(join(tmpdir(), 'release-affected-'));
  const file = join(dir, 'out.json');
  try {
    await runNx([...args, '--json'], file);
    return JSON.parse(readFileSync(file, 'utf8'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function runNx(args, outFile) {
  const out = openSync(outFile, 'w');
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['nx', ...args], {
      cwd: ROOT,
      stdio: ['ignore', out, 'inherit'],
    });
    child.on('error', reject);
    child.on('close', (code) => {
      closeSync(out);
      if (code === 0) resolve();
      else reject(new Error(`nx ${args.join(' ')} exited with ${code}`));
    });
  });
}

/** The file list of `git diff`, NUL-separated so no path comes quoted. */
async function gitChanges(base, head) {
  const { stdout } = await execFileAsync(
    'git',
    ['diff', '-z', '--name-status', '--no-renames', base, head],
    { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }
  );
  const fields = stdout.split('\0').filter((field) => field !== '');
  const changes = [];
  for (let i = 0; i < fields.length; i += 2) {
    changes.push({ status: fields[i], file: fields[i + 1] });
  }
  return changes;
}

async function changesOf({ base, head, files, target }) {
  if (files) {
    const listed = files.split(',').filter((file) => file !== '');
    return {
      changedFiles: listed.filter((file) => existsSync(join(ROOT, file))),
      deletedFiles: listed.filter((file) => !existsSync(join(ROOT, file))),
    };
  }
  const changes = await gitChanges(base, head);
  const modified = changes.filter(({ status }) => status !== 'D');
  return {
    changedFiles: (
      await Promise.all(
        modified.map((change) => refineChange(change, { base, head, target }))
      )
    ).flat(),
    deletedFiles: changes
      .filter(({ status }) => status === 'D')
      .map(({ file }) => file),
  };
}

async function jsonAt(ref, file) {
  const { stdout } = await execFileAsync('git', ['show', `${ref}:${file}`], {
    cwd: ROOT,
    maxBuffer: 16 * 1024 * 1024,
  });
  return JSON.parse(stdout);
}

/**
 * A changed file as the files that count, from both sides of the diff; the
 * file itself where either side can't be read as JSON.
 */
async function refineChange(change, refs) {
  try {
    return await refinedFiles(change, refs);
  } catch (error) {
    console.error(`${change.file}: counted as changed: ${error.message}`);
    return [change.file];
  }
}

async function refinedFiles({ status, file }, { base, head, target }) {
  if (status !== 'M') return [file];
  if (file === TSCONFIG_BASE) {
    return tsconfigBaseChanges(
      await jsonAt(base, file),
      await jsonAt(head, file)
    );
  }
  if (target === 'deploy' && file.endsWith('/package.json')) {
    const bumpOnly = isVersionBumpOnly(
      await jsonAt(base, file),
      await jsonAt(head, file)
    );
    return bumpOnly ? [] : [file];
  }
  return [file];
}

async function candidatesOf({ base, head, files, target, exclude, projects }) {
  const range = files
    ? [`--files=${files}`]
    : [`--base=${base}`, `--head=${head}`];
  const candidates = await nxJson([
    'show',
    'projects',
    '--affected',
    ...range,
    `--withTarget=${target}`,
    ...(exclude ? [`--exclude=${exclude}`] : []),
    ...(projects ? [`--projects=${projects}`] : []),
  ]);
  if (
    !Array.isArray(candidates) ||
    !candidates.every((project) => typeof project === 'string')
  ) {
    throw new Error('unexpected output of nx show projects');
  }
  return candidates;
}

/**
 * The tasks `<project>:<target>` runs, itself included, as `nx run --graph`
 * resolves its `dependsOn`: Nx folds no dependency's inputs into a task's,
 * so `korbjaeger:deploy` alone misses what its `build-app` reads.
 */
async function tasksOf(project, target) {
  const dir = mkdtempSync(join(tmpdir(), 'release-affected-graph-'));
  const file = join(dir, 'graph.json');
  try {
    await runNx(
      [`run`, `${project}:${target}`, `--graph=${file}`],
      '/dev/null'
    );
    const tasks = Object.values(
      JSON.parse(readFileSync(file, 'utf8')).tasks.tasks
    );
    if (tasks.length === 0) throw new Error('empty task graph');
    return tasks.map(({ target: { project, target, configuration } }) => ({
      id: [project, target, configuration].filter(Boolean).join(':'),
      args: [
        'show',
        'target',
        'inputs',
        `${project}:${target}`,
        ...(configuration ? [`--configuration=${configuration}`] : []),
      ],
    }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function taskInputs(args) {
  const { files } = await nxJson(args);
  if (!Array.isArray(files)) {
    throw new Error('unexpected output of nx show target inputs');
  }
  return files;
}

/** Runs `work` on each item, at most `limit` at once. */
async function inPool(items, limit, work) {
  const queue = [...items];
  const workers = Array.from({ length: limit }, async () => {
    while (queue.length > 0) await work(queue.shift());
  });
  await Promise.all(workers);
}

/**
 * Reads the inputs of every candidate's task closure, each task once. A
 * candidate any of whose reads fails gets `undefined`, which keeps it.
 */
async function readInputs(candidates, target) {
  const closures = new Map();
  const failed = new Set();
  await inPool(candidates, PARALLEL_READS, async (project) => {
    try {
      closures.set(project, await tasksOf(project, target));
    } catch (error) {
      console.error(
        `${project}: could not read its ${target} tasks: ${error.message}`
      );
      failed.add(project);
    }
  });
  const tasks = new Map(
    [...closures.values()].flat().map((task) => [task.id, task])
  );
  const inputs = new Map();
  await inPool([...tasks.values()], PARALLEL_READS, async (task) => {
    try {
      inputs.set(task.id, await taskInputs(task.args));
    } catch (error) {
      console.error(`${task.id}: could not read its inputs: ${error.message}`);
    }
  });
  return (project) => {
    const closure = closures.get(project);
    if (failed.has(project) || closure.some(({ id }) => !inputs.has(id))) {
      return undefined;
    }
    return new Set(closure.flatMap(({ id }) => inputs.get(id)));
  };
}

/**
 * Every project's root at the head, from the project graph; `undefined`
 * where it could not be read, which keeps Nx's verdict for a deletion.
 */
async function readProjectRoots() {
  const dir = mkdtempSync(join(tmpdir(), 'release-affected-projects-'));
  const file = join(dir, 'graph.json');
  try {
    await runNx(['graph', `--file=${file}`], '/dev/null');
    const { nodes } = JSON.parse(readFileSync(file, 'utf8')).graph;
    return Object.fromEntries(
      Object.entries(nodes).map(([name, { data }]) => [name, data.root])
    );
  } catch (error) {
    console.error(`could not read the project roots: ${error.message}`);
    return undefined;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function main() {
  const options = readOptions();
  const candidates = await candidatesOf(options);
  const changes = await changesOf(options);
  const { selected, reasons } = selectReleaseAffected({
    candidates,
    ...changes,
    inputsOf: await readInputs(candidates, options.target),
    projectRoots:
      changes.deletedFiles.length > 0 ? await readProjectRoots() : undefined,
  });
  for (const [project, reason] of Object.entries(reasons)) {
    const verdict = selected.includes(project) ? 'kept' : 'dropped';
    console.error(`${verdict} ${project}: ${reason}`);
  }
  for (const project of selected) console.log(project);
}

if (import.meta.filename === process.argv[1]) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
