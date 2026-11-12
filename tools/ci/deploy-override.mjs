// The projects one leg of deploy.yml deploys when a dispatch names them
// (#3058): the named projects of the leg's kind, instead of the selection
// since the last deploy tag, which finds nothing for a version deployed once.
//
//   node tools/ci/deploy-override.mjs --projects=<name,...> --exclude=<pattern> --target=<target>
//
// Prints one project a line. Fails on a name the workspace does not know, and
// on one of the leg's kind without the leg's target (a lib for `deploy`), as
// Nx would silently drop either and the leg would pass with nothing deployed.
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

/** The names of `requested` missing from `present`. */
export function missingProjects(requested, present) {
  const projects = new Set(present);
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
    options: {
      projects: { type: 'string' },
      exclude: { type: 'string' },
      target: { type: 'string' },
    },
  });
  if (!values.exclude) throw new Error('--exclude is required');
  if (!values.target) throw new Error('--target is required');
  const requested = requestedProjects(values.projects);
  const unknown = missingProjects(requested, showProjects([]));
  if (unknown.length > 0) {
    throw new Error(`unknown projects: ${unknown.join(', ')}`);
  }
  const leg = [
    `--projects=${requested.join(',')}`,
    `--exclude=${values.exclude}`,
  ];
  const ofLeg = showProjects(leg);
  const withTarget = showProjects([...leg, `--withTarget=${values.target}`]);
  const targetless = missingProjects(ofLeg, withTarget);
  if (targetless.length > 0) {
    throw new Error(`no ${values.target} target: ${targetless.join(', ')}`);
  }
  for (const project of withTarget) console.log(project);
}

if (import.meta.filename === process.argv[1]) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
