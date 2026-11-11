// Selects the published packages the release versions (#3020): those whose
// `build` task reads a file changed since the package's own last release tag.
//
// `nx release version` counts a commit as touching a project through the
// logic of `nx affected`, which counts every target's inputs, so a commit
// changing only a lint config (`.oxlintrc.json`, `eslint.config.mjs`) bumped,
// and the npm leg then published, every package. The release passes this
// list to `nx release version --projects` instead, and skips the call when it
// is empty. Each package is judged by `release-affected.mjs` (#2888), the
// selection the npm leg of `deploy.yml` publishes by.
//
//   node tools/ci/release-version-projects.mjs [--head=<ref>]
//
// Prints the selected packages, one a line; why each was kept or dropped goes
// to stderr.
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { parseArgs, promisify } from 'node:util';

import { logReasons, releaseAffected } from './release-affected.mjs';

/** The projects `nx release` versions (`release.projects` in `nx.json`). */
const PUBLISHED = 'tag:published';
/** The task the npm leg of `deploy.yml` selects by. */
const TARGET = 'build';

/**
 * @param {object} release
 * @param {string} release.head the commit being released
 * @param {string[]} release.packages the published packages
 * @param {(project: string) => Promise<string | undefined>} release.lastTagOf
 *   the package's latest release tag reachable from `head`, `undefined`
 *   where it has none
 * @param {(range: { base: string, head: string, project: string }) =>
 *   Promise<{ selected: string[], reasons: Record<string, string> }>}
 *   release.select the release-affected selection of one package
 * @returns {Promise<{ selected: string[], reasons: Record<string, string> }>}
 */
export async function releaseVersionProjects({
  head,
  packages,
  lastTagOf,
  select,
}) {
  const selected = [];
  const reasons = {};
  for (const project of packages) {
    const base = await lastTagOf(project);
    if (base === undefined) {
      selected.push(project);
      reasons[project] = 'has no release tag yet';
      continue;
    }
    const selection = await select({ base, head, project });
    if (selection.selected.includes(project)) selected.push(project);
    // Nx's affected list may not name the package at all: nothing changed.
    const reason = selection.reasons[project] ?? 'not affected';
    reasons[project] = `since ${base}: ${reason}`;
  }
  return { selected, reasons };
}

// --- CLI --------------------------------------------------------------------

const ROOT = join(import.meta.dirname, '..', '..');
const execFileAsync = promisify(execFile);

async function run(command, args) {
  const { stdout } = await execFileAsync(command, args, {
    cwd: ROOT,
    maxBuffer: 16 * 1024 * 1024,
  });
  return stdout;
}

async function publishedPackages() {
  const projects = JSON.parse(
    await run('npx', [
      'nx',
      'show',
      'projects',
      `--projects=${PUBLISHED}`,
      '--json',
    ])
  );
  if (
    !Array.isArray(projects) ||
    !projects.every((project) => typeof project === 'string')
  ) {
    throw new Error('unexpected output of nx show projects');
  }
  return projects;
}

/**
 * The newest `<project>@<version>` tag (`releaseTag.pattern`, Nx's default
 * for independent versioning) reachable from `head`.
 */
async function lastTagOf(project, head) {
  const tags = await run('git', [
    'tag',
    '--list',
    `${project}@*`,
    '--merged',
    head,
    '--sort=-v:refname',
  ]);
  return tags.split('\n').find((tag) => tag !== '');
}

async function main() {
  const { values } = parseArgs({ options: { head: { type: 'string' } } });
  const head = values.head ?? 'HEAD';
  const selection = await releaseVersionProjects({
    head,
    packages: await publishedPackages(),
    lastTagOf: (project) => lastTagOf(project, head),
    select: ({ base, project }) =>
      releaseAffected({ base, head, target: TARGET, projects: project }),
  });
  logReasons(selection);
  for (const project of selection.selected) console.log(project);
}

if (import.meta.filename === process.argv[1]) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
