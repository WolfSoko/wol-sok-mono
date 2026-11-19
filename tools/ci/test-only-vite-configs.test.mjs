// A Vite config that only runs Vitest is no production input (#3136).
//
// `namedInputs.production` in `nx.json` leaves out test-only files, so a
// change to them releases nothing (`tools/ci/release-affected.mjs` selects by
// the `build` and `deploy` inputs). A lib that builds with `tsc` or
// ng-packagr and runs Vite only for its tests names the config
// `vitest.config.mts`, which `production` excludes; a `vite.config.*` is kept
// for projects that build with Vite (the Analog apps), where it is a real
// build input.
import assert from 'node:assert/strict';
import { dirname, matchesGlob } from 'node:path';
import { describe, it } from 'node:test';
import { gitLsFiles, readJson, readProjects } from './workspace-projects.mjs';

const VITEST_CONFIG_EXCLUSION = '!{projectRoot}/vitest.config.*';

/** Executors whose `build` reads the project's `vite.config.*`. */
const VITE_BUILD_EXECUTORS = new Set([
  '@analogjs/platform:vite',
  '@nx/vite:build',
]);

/**
 * The `production` entries that wrongly treat Vite configs: a missing
 * exclusion of `vitest.config.*`, and any exclusion matching one of the
 * `viteBuildConfigs` (`{ root, config }`, paths from the workspace root),
 * which would drop that project's build input.
 */
function productionInputProblems(production, viteBuildConfigs) {
  const problems = [];
  if (!production.includes(VITEST_CONFIG_EXCLUSION)) {
    problems.push(`missing ${VITEST_CONFIG_EXCLUSION}`);
  }
  const exclusions = production.filter(
    (input) => typeof input === 'string' && input.startsWith('!')
  );
  for (const exclusion of exclusions) {
    const excluded = viteBuildConfigs.filter(({ root, config }) =>
      matchesGlob(config, exclusion.slice(1).replaceAll('{projectRoot}', root))
    );
    if (excluded.length > 0) {
      problems.push(
        `${exclusion} excludes a Vite build config: ${excluded.map(({ config }) => config).join(', ')}`
      );
    }
  }
  return problems;
}

/**
 * Whether a project's `vite.config.*` serves its build: its `project.json`
 * declares a `build` running a Vite build executor. An inferred `build` does
 * not count, since `@nx/vite/plugin` infers none for a config that only
 * runs Vitest.
 */
function buildsWithVite(project) {
  return VITE_BUILD_EXECUTORS.has(project.targets?.build?.executor);
}

/** The deepest of the `projects` (`{ path, json }`) holding `file`. */
function projectOf(file, projects) {
  return projects
    .map((project) => ({ ...project, root: dirname(project.path) }))
    .filter(({ root }) => root === '.' || file.startsWith(`${root}/`))
    .sort((a, b) => b.root.length - a.root.length)[0];
}

void describe('productionInputProblems', () => {
  const viteBuildConfigs = [
    { root: 'apps/a', config: 'apps/a/vite.config.ts' },
  ];

  void it('accepts production excluding vitest.config.*', () => {
    assert.deepEqual(
      productionInputProblems(
        ['default', VITEST_CONFIG_EXCLUSION],
        viteBuildConfigs
      ),
      []
    );
  });

  void it('names a missing vitest.config.* exclusion', () => {
    assert.deepEqual(productionInputProblems(['default'], viteBuildConfigs), [
      `missing ${VITEST_CONFIG_EXCLUSION}`,
    ]);
  });

  void it('names every exclusion matching a Vite build config', () => {
    for (const exclusion of [
      '!{projectRoot}/vite.config.*',
      '!{projectRoot}/{vite,vitest}.config.*',
      '!{projectRoot}/*.config.*',
    ]) {
      assert.deepEqual(
        productionInputProblems(
          [VITEST_CONFIG_EXCLUSION, exclusion],
          viteBuildConfigs
        ),
        [`${exclusion} excludes a Vite build config: apps/a/vite.config.ts`]
      );
    }
  });
});

void describe('buildsWithVite', () => {
  void it('takes a declared build with a Vite build executor', () => {
    for (const executor of VITE_BUILD_EXECUTORS) {
      assert.equal(buildsWithVite({ targets: { build: { executor } } }), true);
    }
  });

  void it('refuses another executor, and a build it cannot see', () => {
    for (const executor of ['@nx/js:tsc', '@nx/angular:ng-packagr-lite']) {
      assert.equal(buildsWithVite({ targets: { build: { executor } } }), false);
    }
    assert.equal(buildsWithVite({ targets: { build: {} } }), false);
    assert.equal(buildsWithVite({ targets: {} }), false);
  });
});

void describe('projectOf', () => {
  const projects = [
    { path: 'project.json', json: { name: 'root' } },
    { path: 'libs/a/project.json', json: { name: 'a' } },
    { path: 'libs/a/b/project.json', json: { name: 'b' } },
  ];

  void it('takes the deepest project holding the file', () => {
    assert.equal(projectOf('libs/a/b/vite.config.ts', projects).json.name, 'b');
    assert.equal(projectOf('libs/a/vite.config.ts', projects).json.name, 'a');
    assert.equal(
      projectOf('libs/ab/vite.config.ts', projects).json.name,
      'root'
    );
  });
});

void describe('vite.config files', () => {
  const projects = readProjects();
  const configs = gitLsFiles('*vite.config.*')
    .filter((file) => !file.includes('.timestamp'))
    .map((config) => ({ config, project: projectOf(config, projects) }));

  void it('are found', () => {
    assert.ok(configs.length > 0, 'no vite.config tracked');
  });

  for (const { config, project } of configs) {
    void it(`${config} belongs to a project that builds with Vite`, () => {
      assert.ok(project !== undefined, `${config} lies in no project`);
      assert.ok(
        buildsWithVite(project.json),
        `${project.path} declares no Vite build: rename ${config} to vitest.config.mts, which production leaves out`
      );
    });
  }

  void it('stay in nx.json production, which leaves out vitest.config.*', () => {
    const viteBuildConfigs = configs.map(({ config, project }) => ({
      root: dirname(project.path),
      config,
    }));
    assert.deepEqual(
      productionInputProblems(
        readJson('nx.json').namedInputs.production,
        viteBuildConfigs
      ),
      []
    );
  });
});
