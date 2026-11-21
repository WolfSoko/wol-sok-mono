// The scripts outside every project (root configs, .agents/, .github/,
// __checks__/) are linted by the root project's `lint` target (#3140).
// @nx/oxlint infers no target for the root project, so `project.json` at the
// root lists them by hand, and oxlint expands no globs: this guard keeps the
// list and the target's inputs complete.
import assert from 'node:assert/strict';
import { matchesGlob } from 'node:path';
import { describe, it } from 'node:test';
import {
  assertRunsOnEveryCiRun,
  gitLsFiles,
  rootProjectFiles,
  lintedScripts,
  LOCKFILE_INPUT,
  readJson,
  stringInputs,
} from './workspace-projects.mjs';

const ROOT_PROJECT = 'project.json';
const LINT_EXECUTOR = '@nx/oxlint:lint';
const PROJECT_ROOT_PREFIX = '{projectRoot}/';
// A new root script makes only the root project affected, never `tools`, so
// CI runs this guard on every run as a step of its own, outside Nx.
const GUARD_STEP_NAME = '- name: Root scripts are linted';
const GUARD_COMMAND = 'run: node --test tools/ci/root-lint.test.mjs';

const lintTarget = readJson(ROOT_PROJECT).targets?.lint ?? {};
const lintFilePatterns = lintTarget.options?.lintFilePatterns ?? [];
const fileInputs = stringInputs(lintTarget.inputs)
  .filter((input) => input.startsWith(PROJECT_ROOT_PREFIX))
  .map((input) => input.slice(PROJECT_ROOT_PREFIX.length));

/** The linted scripts no other project's root contains. */
function rootScripts() {
  return rootProjectFiles(lintedScripts());
}

function underPattern(path) {
  return lintFilePatterns.some(
    (pattern) => path === pattern || path.startsWith(`${pattern}/`)
  );
}

function readByInputs(path) {
  return fileInputs.some((glob) => matchesGlob(path, glob));
}

void describe('the root project lint target', () => {
  void it('runs oxlint, cached', () => {
    assert.equal(lintTarget.executor, LINT_EXECUTOR);
    assert.equal(lintTarget.cache, true);
  });

  void it('lints every script outside the other projects', () => {
    assert.deepEqual(
      rootScripts().filter((path) => !underPattern(path)),
      [],
      `add the files to lintFilePatterns in ${ROOT_PROJECT}`
    );
  });

  void it('reads every one of them as an input, so a change re-lints', () => {
    assert.deepEqual(
      rootScripts().filter((path) => !readByInputs(path)),
      [],
      `add the files to the lint inputs in ${ROOT_PROJECT}`
    );
  });

  // Type-aware lint reads installed type packages that Nx hashes only through
  // the lockfile (#3151); these inputs replace the targetDefaults entry's.
  void it('reads the lockfile as an input', () => {
    assert.ok(lintTarget.inputs.includes(LOCKFILE_INPUT));
  });

  void it('names only tracked files and folders', () => {
    assert.deepEqual(
      lintFilePatterns.filter((pattern) => gitLsFiles(pattern).length === 0),
      []
    );
  });
});

void describe('the CI workflow', () => {
  void it('runs this guard on every run, outside the affected tasks', () => {
    assertRunsOnEveryCiRun(GUARD_STEP_NAME, GUARD_COMMAND);
  });
});
