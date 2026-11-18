// Selects what the npm leg of deploy.yml publishes (#3049): the published
// packages whose `package.json` version changed between the last npm deploy
// and the release, the ones `nx release version` bumped. A build input changed
// by a commit of a non-releasing type (refactor, chore, perf) bumps nothing,
// and publishing it again would offer npm a version it already has.
//
//   node tools/ci/bumped-packages.mjs --base=<ref> --head=<ref> --projects=<pattern>
//
// Prints one package a line. Fails on an unknown ref or an unreadable
// manifest, so the leg never takes a failure for an empty selection.
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';

const ROOT = join(dirname(import.meta.filename), '../..');

/**
 * The packages whose version at `head` differs from the one at `base`; a
 * package without a version at `base` (new, or the first deploy) counts as
 * bumped, one without a version at `head` is not published.
 *
 * @param {string[]} packages the candidates
 * @param {(ref: string, name: string) => string | undefined} versionAt
 * @param {string} base
 * @param {string} head
 * @returns {string[]}
 */
export function bumpedPackages(packages, versionAt, base, head) {
  return packages.filter((name) => {
    const released = versionAt(head, name);
    return released !== undefined && released !== versionAt(base, name);
  });
}

function run(command, args) {
  return execFileSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function nxJson(args) {
  return JSON.parse(run('npx', ['nx', 'show', ...args, '--json']));
}

/** Fails unless `ref` names a tree (a commit, a tag or the empty tree). */
function assertTree(ref) {
  run('git', ['rev-parse', '--verify', '--quiet', `${ref}^{tree}`]);
}

/** Whether `path` exists at `ref`; `ref` is known to name a tree. */
function existsAt(ref, path) {
  return run('git', ['ls-tree', '--name-only', ref, '--', path]).trim() !== '';
}

/** The `version` of `<root>/package.json` at `ref`, if the file exists. */
function manifestVersion(ref, root) {
  const path = `${root}/package.json`;
  if (!existsAt(ref, path)) return undefined;
  const { version } = JSON.parse(run('git', ['show', `${ref}:${path}`]));
  if (typeof version !== 'string') {
    throw new Error(`${path} at ${ref} has no version`);
  }
  return version;
}

function main() {
  const { values } = parseArgs({
    options: {
      base: { type: 'string' },
      head: { type: 'string' },
      projects: { type: 'string' },
    },
  });
  for (const option of ['base', 'head', 'projects']) {
    if (!values[option]) throw new Error(`--${option} is required`);
  }
  assertTree(values.base);
  assertTree(values.head);
  const packages = nxJson(['projects', `--projects=${values.projects}`]);
  const roots = new Map(
    packages.map((name) => [name, nxJson(['project', name]).root])
  );
  const versionAt = (ref, name) => manifestVersion(ref, roots.get(name));
  for (const name of bumpedPackages(
    packages,
    versionAt,
    values.base,
    values.head
  )) {
    console.log(name);
  }
}

if (import.meta.filename === process.argv[1]) {
  try {
    main();
  } catch (error) {
    console.error(error.stderr?.toString() || error.message);
    process.exit(1);
  }
}
