// Local Nx plugin (#3131): infers `typecheck-specs` for every project with a
// tsconfig.spec.json. Jest and Vitest run specs transpile-only, so a fake or a
// call in a spec drifts from the real types unnoticed unless tsc checks them;
// CI runs the target among its affected ones. The plugin owns the whole target
// definition rather than nx.json's targetDefaults: no app imports this file,
// so a change here is no build or deploy input, while a change of nx.json
// releases every app (tools/ci/release-affected.mjs). A project.json only
// adds a `dependsOn` to the inferred target, as angular-examples does.
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const SPEC_TSCONFIG = 'tsconfig.spec.json';
const DEFAULT_TARGET_NAME = 'typecheck-specs';
// Only a project.json marks a project root here: the root package.json has
// no `workspaces`, so Nx takes no folder with just a package.json as a project,
// and the plugin must not turn one into a project of its own.
const PROJECT_FILE = 'project.json';
// The plugin is an input of the target it defines, so a run after a change
// here is never answered from the cache. Nx's `affected` still names only
// `tools` for such a change: run every target by hand (CLAUDE.md).
export const PLUGIN_FILE = 'tools/nx/typecheck-specs.mjs';

/** @type {import('@nx/devkit').TargetConfiguration} */
const TYPECHECK_SPECS_TARGET = {
  command: `tsc -p {projectRoot}/${SPEC_TSCONFIG} --noEmit`,
  inputs: [
    'default',
    '^production',
    '{workspaceRoot}/tsconfig.base.json',
    `{workspaceRoot}/${PLUGIN_FILE}`,
  ],
  cache: true,
};

/**
 * @typedef {{ targetName?: string }} TypecheckSpecsOptions
 * @type {import('@nx/devkit').CreateNodes<TypecheckSpecsOptions>}
 */
export const createNodes = [
  `**/${SPEC_TSCONFIG}`,
  (specTsconfigs, options, { workspaceRoot }) => {
    const targetName = options?.targetName ?? DEFAULT_TARGET_NAME;
    return specTsconfigs
      .map((specTsconfig) => [specTsconfig, dirname(specTsconfig)])
      .filter(([, root]) => isProjectRoot(join(workspaceRoot, root)))
      .map(([specTsconfig, root]) => [
        specTsconfig,
        {
          projects: {
            [root]: {
              targets: { [targetName]: { ...TYPECHECK_SPECS_TARGET } },
            },
          },
        },
      ]);
  },
];

function isProjectRoot(folder) {
  return existsSync(join(folder, PROJECT_FILE));
}
