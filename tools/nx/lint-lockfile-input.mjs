// Local Nx plugin (#3151): makes the lockfile an input of every `lint` target
// that @nx/oxlint infers. Type-aware oxlint reads the types of installed
// packages, and Nx hashes only some of them: the @nx/oxlint executor's own
// dependency closure and the packages the project and its dependencies
// import. A package only a tsconfig names in `types` (`@types/jest`, often
// `@types/node`) is in no lint hash, so its bump could change a finding while
// Nx replays a cached green lint. A per-package list cannot fix that: Nx
// ignores `externalDependencies` on an executor target, and `node_modules` is
// not hashed. The lockfile pins every installed version, so it is the input.
//
// Registered in nx.json after @nx/oxlint: Nx merges the `'...'` spread with
// the inferred inputs, so they all stay and the lockfile comes last. It takes
// every project.json whose folder or an ancestor below the workspace root
// holds a tsconfig.json, the program type-aware oxlint types the project's
// scripts in (the nested `tools-*` projects share `tools/tsconfig.json`).
// `bacteria-wars-android`, the only project without `lint`, has none, so the
// plugin never creates a target of its own. The root project's
// `lint` is hand-written in the root project.json, whose inputs replace the
// inferred ones, so it names the lockfile itself.
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const TSCONFIG = 'tsconfig.json';
const DEFAULT_TARGET_NAME = 'lint';
// Only a project.json marks a project root here: the root package.json has
// no `workspaces`, so Nx takes no folder with just a package.json as a project.
const PROJECT_FILE = 'project.json';
const WORKSPACE_ROOT_PROJECT = '.';
export const LOCKFILE_INPUT = '{workspaceRoot}/package-lock.json';

/**
 * @typedef {{ targetName?: string }} LintLockfileInputOptions
 * @type {import('@nx/devkit').CreateNodes<LintLockfileInputOptions>}
 */
export const createNodes = [
  `**/${PROJECT_FILE}`,
  (projectFiles, options, { workspaceRoot }) => {
    const targetName = options?.targetName ?? DEFAULT_TARGET_NAME;
    return projectFiles
      .map((projectFile) => [projectFile, dirname(projectFile)])
      .filter(([, root]) => root !== WORKSPACE_ROOT_PROJECT)
      .filter(([, root]) => hasProjectTsconfig(workspaceRoot, root))
      .map(([projectFile, root]) => [
        projectFile,
        {
          projects: {
            [root]: {
              targets: { [targetName]: { inputs: ['...', LOCKFILE_INPUT] } },
            },
          },
        },
      ]);
  },
];

/**
 * Whether the project's folder or one of its ancestors below the workspace
 * root holds a tsconfig.json. The root's own belongs to the root scripts.
 */
function hasProjectTsconfig(workspaceRoot, root) {
  for (let folder = root; folder !== WORKSPACE_ROOT_PROJECT;) {
    if (existsSync(join(workspaceRoot, folder, TSCONFIG))) {
      return true;
    }
    folder = dirname(folder);
  }
  return false;
}
