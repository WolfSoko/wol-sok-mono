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
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { ROOT, gitLsFiles, readJson } from './workspace-projects.mjs';

const VITEST_CONFIG_EXCLUSION = '!{projectRoot}/vitest.config.*';

/** Executors whose `build` reads the project's `vite.config.*`. */
const VITE_BUILD_EXECUTORS = new Set([
  '@analogjs/platform:vite',
  '@nx/vite:build',
]);

/**
 * The `production` entries that wrongly treat Vite configs: a missing
 * exclusion of `vitest.config.*`, and any exclusion of `vite.config.*`,
 * which would drop the Vite apps' build input.
 */
function productionInputProblems(production) {
  const problems = [];
  if (!production.includes(VITEST_CONFIG_EXCLUSION)) {
    problems.push(`missing ${VITEST_CONFIG_EXCLUSION}`);
  }
  for (const input of production) {
    if (typeof input === 'string' && /^!.*\bvite\.config\b/.test(input)) {
      problems.push(`excludes a Vite build config: ${input}`);
    }
  }
  return problems;
}

/**
 * Whether a project's `vite.config.*` serves its build: `project.json`
 * names no `build` target (so `@nx/vite/plugin` infers a Vite one), or one
 * running a Vite build executor.
 */
function buildsWithVite(project) {
  const build = project.targets?.build;
  return build === undefined || VITE_BUILD_EXECUTORS.has(build.executor);
}

/** The folder of the nearest `project.json` at or above `file`'s folder. */
function projectRootOf(file) {
  for (let dir = dirname(file); dir !== dirname(dir); dir = dirname(dir)) {
    if (existsSync(join(ROOT, dir, 'project.json'))) {
      return dir;
    }
  }
  return undefined;
}

void describe('productionInputProblems', () => {
  void it('accepts production excluding vitest.config.*', () => {
    assert.deepEqual(
      productionInputProblems(['default', VITEST_CONFIG_EXCLUSION]),
      []
    );
  });

  void it('names a missing vitest.config.* exclusion', () => {
    assert.deepEqual(productionInputProblems(['default']), [
      `missing ${VITEST_CONFIG_EXCLUSION}`,
    ]);
  });

  void it('names an exclusion of vite.config.*', () => {
    assert.deepEqual(
      productionInputProblems([
        VITEST_CONFIG_EXCLUSION,
        '!{projectRoot}/vite.config.*',
      ]),
      ['excludes a Vite build config: !{projectRoot}/vite.config.*']
    );
  });
});

void describe('buildsWithVite', () => {
  void it('takes an inferred build and the Vite build executors', () => {
    assert.equal(buildsWithVite({ targets: {} }), true);
    assert.equal(buildsWithVite({}), true);
    assert.equal(
      buildsWithVite({
        targets: { build: { executor: '@analogjs/platform:vite' } },
      }),
      true
    );
    assert.equal(
      buildsWithVite({ targets: { build: { executor: '@nx/vite:build' } } }),
      true
    );
  });

  void it('refuses a build with another executor', () => {
    assert.equal(
      buildsWithVite({ targets: { build: { executor: '@nx/js:tsc' } } }),
      false
    );
    assert.equal(
      buildsWithVite({
        targets: { build: { executor: '@nx/angular:ng-packagr-lite' } },
      }),
      false
    );
  });
});

void describe('nx.json production', () => {
  void it('leaves out test-only Vite configs and keeps Vite build configs', () => {
    assert.deepEqual(
      productionInputProblems(readJson('nx.json').namedInputs.production),
      []
    );
  });
});

void describe('vite.config files', () => {
  const configs = gitLsFiles('*vite.config.*').filter(
    (file) => !file.includes('.timestamp')
  );

  void it('are found', () => {
    assert.ok(configs.length > 0, 'no vite.config tracked');
  });

  for (const config of configs) {
    void it(`${config} belongs to a project that builds with Vite`, () => {
      const root = projectRootOf(config);
      assert.ok(root !== undefined, `${config} lies in no project`);
      assert.ok(
        buildsWithVite(readJson(join(root, 'project.json'))),
        `${root} does not build with Vite: rename ${config} to vitest.config.mts, which production leaves out`
      );
    });
  }
});
