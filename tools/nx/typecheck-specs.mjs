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
// The files Nx itself takes as the mark of a project root.
const PROJECT_FILES = ['project.json', 'package.json'];

/** @type {import('@nx/devkit').TargetConfiguration} */
const TYPECHECK_SPECS_TARGET = {
  command: `tsc -p {projectRoot}/${SPEC_TSCONFIG} --noEmit`,
  inputs: ['default', '^production', '{workspaceRoot}/tsconfig.base.json'],
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
  return PROJECT_FILES.some((file) => existsSync(join(folder, file)));
}
