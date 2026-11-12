// The projects one leg of deploy.yml deploys when a dispatch names them
// (#3058): the named projects of the leg's kind, instead of the selection
// since the last deploy tag, which finds nothing for a version deployed once.
//
//   node tools/ci/deploy-override.mjs --projects=<name,...> --exclude=<pattern>
//
// Prints one project a line; fails on a name the workspace does not know, as
// Nx would silently drop it.
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';

const ROOT = join(dirname(import.meta.filename), '../..');

/** The names in a comma-separated list; at least one. */
export function requestedProjects(list) {
  const names = (list ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name !== '');
  if (names.length === 0) throw new Error('--projects names no project');
  return names;
}

/** The requested names that are no project of the workspace. */
export function unknownProjects(requested, known) {
  const projects = new Set(known);
  return requested.filter((name) => !projects.has(name));
}

function showProjects(args) {
  const stdout = execFileSync(
    'npx',
    ['nx', 'show', 'projects', '--json', ...args],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }
  );
  const projects = JSON.parse(stdout);
  if (!Array.isArray(projects)) {
    throw new Error('unexpected output of nx show projects');
  }
  return projects;
}

function main() {
  const { values } = parseArgs({
    options: { projects: { type: 'string' }, exclude: { type: 'string' } },
  });
  if (!values.exclude) throw new Error('--exclude is required');
  const requested = requestedProjects(values.projects);
  const unknown = unknownProjects(requested, showProjects([]));
  if (unknown.length > 0) {
    throw new Error(`unknown projects: ${unknown.join(', ')}`);
  }
  const ofLeg = showProjects([
    `--projects=${requested.join(',')}`,
    `--exclude=${values.exclude}`,
  ]);
  for (const project of ofLeg) console.log(project);
}

if (import.meta.filename === process.argv[1]) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
