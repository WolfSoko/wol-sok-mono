// Spec of the local Nx plugin that makes the lockfile an input of every
// inferred oxlint `lint` target (#3151), and of the root project's hand-written
// `lint`, which replaces inferred inputs and so needs it by hand. Each plugin
// case lays out a workspace in a temp folder and runs createNodes on it, as Nx
// does with the files matching its pattern. `describe` and `it` return
// promises `node:test` awaits itself, hence the `void`.
import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, matchesGlob } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { createNodes, LOCKFILE_INPUT } from './lint-lockfile-input.mjs';

const [pattern, inferTargets] = createNodes;
const PROJECT = 'libs/utils/a/project.json';
const TSCONFIG = 'libs/utils/a/tsconfig.json';
const WORKSPACE_ROOT = join(import.meta.dirname, '..', '..');

let workspaceRoot;

before(() => {
  workspaceRoot = mkdtempSync(join(tmpdir(), 'lint-lockfile-input-'));
});

after(() => rmSync(workspaceRoot, { recursive: true, force: true }));

let caseCount = 0;

/** Writes the files into a fresh folder below the temp workspace. */
function layOut(files) {
  const caseRoot = `case-${++caseCount}`;
  for (const file of files) {
    const path = join(workspaceRoot, caseRoot, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, '{}');
  }
  return caseRoot;
}

async function infer(files, projectFiles, options) {
  const caseRoot = layOut(files);
  const results = await inferTargets(
    projectFiles.map((file) => `${caseRoot}/${file}`),
    options,
    { workspaceRoot, nxJsonConfiguration: {} }
  );
  return results.map(([file, result]) => [
    file.slice(caseRoot.length + 1),
    Object.fromEntries(
      Object.entries(result.projects ?? {}).map(([root, project]) => [
        root.slice(caseRoot.length + 1),
        project,
      ])
    ),
  ]);
}

const LOCKFILE_LINT = {
  targets: {
    lint: { inputs: ['...', '{workspaceRoot}/package-lock.json'] },
  },
};

void describe('lint-lockfile-input plugin', () => {
  void it('matches every project.json', () => {
    assert.ok(matchesGlob(PROJECT, pattern));
    assert.ok(matchesGlob('apps/app/project.json', pattern));
    assert.ok(!matchesGlob('libs/utils/a/package.json', pattern));
  });

  void it('appends the lockfile to the lint inputs of a project with a tsconfig.json', async () => {
    const results = await infer([PROJECT, TSCONFIG], [PROJECT]);
    assert.deepEqual(results, [[PROJECT, { 'libs/utils/a': LOCKFILE_LINT }]]);
  });

  void it('takes a nested project typed by an ancestor tsconfig.json', async () => {
    const nested = 'tools/relay/project.json';
    const results = await infer([nested, 'tools/tsconfig.json'], [nested]);
    assert.deepEqual(results, [[nested, { 'tools/relay': LOCKFILE_LINT }]]);
  });

  void it('skips a project without a tsconfig.json, which oxlint lints not', async () => {
    const results = await infer([PROJECT], [PROJECT]);
    assert.deepEqual(results, []);
  });

  void it('skips the root project, whose lint is hand-written', async () => {
    const results = await inferTargets(['project.json'], undefined, {
      workspaceRoot: WORKSPACE_ROOT,
      nxJsonConfiguration: {},
    });
    assert.deepEqual(results, []);
  });

  void it('names the target after the targetName option', async () => {
    const results = await infer([PROJECT, TSCONFIG], [PROJECT], {
      targetName: 'oxlint',
    });
    assert.deepEqual(Object.keys(results[0][1]['libs/utils/a'].targets), [
      'oxlint',
    ]);
  });
});

void describe('root project lint', () => {
  const rootLintInputs = JSON.parse(
    readFileSync(join(WORKSPACE_ROOT, 'project.json'), 'utf8')
  ).targets.lint.inputs;

  void it('names the lockfile', () => {
    assert.ok(rootLintInputs.includes(LOCKFILE_INPUT));
  });

  // Nx ignores externalDependencies on an executor target such as
  // @nx/oxlint:lint, so the entry would only read as if it worked.
  void it('lists no externalDependencies', () => {
    assert.deepEqual(
      rootLintInputs.filter((input) => input?.externalDependencies),
      []
    );
  });
});
