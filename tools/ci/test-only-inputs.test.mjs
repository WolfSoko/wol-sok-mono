// Files only tests read are no production input (#3205).
//
// `namedInputs.production` in `nx.json` is what every `build` and, through
// it, every `deploy` hashes, and `tools/ci/release-affected.mjs` selects a
// release by those inputs. A test-only file it does not exclude redeploys
// apps on a change that ships nothing: a Playwright page object below
// `e2e/`, the rules test of `rules-test/`, a `jest.config.cts`.
import assert from 'node:assert/strict';
import { matchesGlob } from 'node:path';
import { describe, it } from 'node:test';
import {
  gitLsFiles,
  projectOf,
  readJson,
  readProjects,
} from './workspace-projects.mjs';

/** Paths below a project root that only tests read. */
const TEST_ONLY_PATTERNS = [
  'jest.config.*',
  'tsconfig.e2e.json',
  'e2e/**/*',
  'rules-test/**/*',
];

/** The `!` patterns of an inputs list, string or `fileset`, without the `!`. */
function exclusions(production) {
  return production
    .map((input) => (typeof input === 'string' ? input : input.fileset))
    .filter((pattern) => pattern?.startsWith('!'))
    .map((pattern) => pattern.slice(1));
}

/**
 * The `files` (`{ root, file }`, paths from the workspace root) that no
 * exclusion of `production` matches in their project.
 */
function unexcluded(production, files) {
  const patterns = exclusions(production);
  return files
    .filter(
      ({ root, file }) =>
        !patterns.some((pattern) =>
          matchesGlob(file, pattern.replaceAll('{projectRoot}', root))
        )
    )
    .map(({ file }) => file);
}

/** The tracked files of `paths` with the root of their project. */
function inProjects(paths, projects) {
  return paths
    .map((file) => ({ file, project: projectOf(file, projects) }))
    .filter(({ project }) => project !== undefined && project.root !== '.')
    .map(({ file, project }) => ({ root: project.root, file }));
}

/** Whether `file` lies at one of the test-only patterns of its `root`. */
function isTestOnly({ root, file }) {
  return TEST_ONLY_PATTERNS.some((pattern) =>
    matchesGlob(file, `${root}/${pattern}`)
  );
}

void describe('unexcluded', () => {
  const files = [
    { root: 'apps/a', file: 'apps/a/jest.config.cts' },
    { root: 'apps/a', file: 'apps/a/e2e/pos/home.po.ts' },
  ];

  void it('names the files no exclusion matches', () => {
    assert.deepEqual(
      unexcluded(['default', '!{projectRoot}/jest.config.[jt]s'], files),
      ['apps/a/jest.config.cts', 'apps/a/e2e/pos/home.po.ts']
    );
  });

  void it('takes string and fileset exclusions', () => {
    assert.deepEqual(
      unexcluded(
        [
          'default',
          '!{projectRoot}/jest.config.*',
          { fileset: '!{projectRoot}/e2e/**/*' },
        ],
        files
      ),
      []
    );
  });

  void it('resolves {projectRoot} against the file project', () => {
    assert.deepEqual(
      unexcluded(
        ['!{projectRoot}/e2e/**/*'],
        [{ root: 'apps/b', file: 'apps/a/e2e/pos/home.po.ts' }]
      ),
      ['apps/a/e2e/pos/home.po.ts']
    );
  });
});

void describe('isTestOnly', () => {
  void it('takes the test-only paths at the project root', () => {
    for (const file of [
      'apps/a/jest.config.ts',
      'apps/a/jest.config.cts',
      'apps/a/tsconfig.e2e.json',
      'apps/a/e2e/home.spec.ts',
      'apps/a/rules-test/firebase.json',
    ]) {
      assert.equal(isTestOnly({ root: 'apps/a', file }), true, file);
    }
  });

  void it('leaves source and nested look-alikes alone', () => {
    for (const file of [
      'apps/a/src/main.ts',
      'apps/a/src/environments/environment.e2e.ts',
      'apps/a/src/e2e/helper.ts',
    ]) {
      assert.equal(isTestOnly({ root: 'apps/a', file }), false, file);
    }
  });
});

void describe('nx.json production', () => {
  const production = readJson('nx.json').namedInputs.production;
  const projects = readProjects();
  const testOnly = inProjects(
    gitLsFiles(
      '**/jest.config.*',
      '**/tsconfig.e2e.json',
      '**/e2e/**',
      '**/rules-test/**'
    ),
    projects
  ).filter(isTestOnly);

  void it('finds test-only files', () => {
    assert.ok(testOnly.length > 0, 'no test-only file tracked');
  });

  void it('excludes every test-only file', () => {
    assert.deepEqual(unexcluded(production, testOnly), []);
  });

  void it('keeps every app entry point', () => {
    const entries = inProjects(gitLsFiles('apps/*/src/main.ts'), projects);
    assert.ok(entries.length > 0, 'no app entry point tracked');
    assert.deepEqual(
      unexcluded(production, entries),
      entries.map(({ file }) => file)
    );
  });
});
