// Local Nx plugin (#3151): appends the lockfile to every `lint` target that
// @nx/oxlint infers. Type-aware oxlint reads installed type packages that Nx
// hashes for this executor only through the lockfile (a package only a
// tsconfig names in `types`; `externalDependencies` is ignored on executor
// targets). It must stay after @nx/oxlint in nx.json, so the `'...'` spread
// has the inferred inputs to keep. It takes every project.json with a
// tsconfig.json in its folder or an ancestor below the root (the `tools-*`
// projects share `tools/tsconfig.json`), which today is every project oxlint
// lints; the root project's hand-written `lint` names the lockfile itself.
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const TSCONFIG = 'tsconfig.json';
// Must match the targetName @nx/oxlint gets in nx.json.
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
