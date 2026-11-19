// Keeps target inputs pointing at real files (#2946). Nx matches an input
// that names a missing file against nothing and reports nothing, so a typo
// (`jest.preset.js` for `jest.preset.cjs`) or a renamed file silently drops
// the input. Nx also leaves `{projectName}` unresolved in inputs (#2904).
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import {
  CI_WORKFLOW,
  ROOT,
  SKIPPING_KEYS,
  readJson,
  readProjects,
  stepBlock,
} from './workspace-projects.mjs';

const WORKSPACE_ROOT = '{workspaceRoot}/';
const PROJECT_ROOT = '{projectRoot}/';
const PROJECT_NAME = '{projectName}';
// A renamed file makes only its own project affected, never `tools`, so CI
// runs this guard on every run as a step of its own, outside Nx (#3051).
const GUARD_STEP_NAME = '- name: Target inputs name existing files';
const GUARD_COMMAND = 'run: node --test tools/ci/target-inputs.test.mjs';
// A path holding one of these is a pattern, not a single file.
const GLOB_CHARACTERS = /[*?{}[\]!]/;

/**
 * The file patterns of an inputs list: its strings and the patterns of its
 * `fileset` objects. Other object inputs (`runtime`, `env`, …) name no file.
 */
function filePatterns(inputs) {
  return (inputs ?? []).flatMap((input) => {
    if (typeof input === 'string') return [input];
    return typeof input?.fileset === 'string' ? [input.fileset] : [];
  });
}

/**
 * The file patterns of one list, each with where it was found and the
 * project root `{projectRoot}` stands for (`null` in nx.json, where it
 * resolves per project).
 */
function located(where, projectRoot, inputs) {
  return filePatterns(inputs).map((input) => ({ where, projectRoot, input }));
}

/**
 * Every file pattern as `{ where, projectRoot, input }`, from the targets
 * and named inputs of each project.json and from nx.json.
 */
function allInputs() {
  const nx = readJson('nx.json');
  return [
    ...readProjects().flatMap(({ path, json }) => [
      ...Object.entries(json.targets ?? {}).flatMap(([name, target]) =>
        located(`${path} ${name}`, dirname(path), target.inputs)
      ),
      ...Object.entries(json.namedInputs ?? {}).flatMap(([name, inputs]) =>
        located(`${path} namedInputs ${name}`, dirname(path), inputs)
      ),
    ]),
    ...Object.entries(nx.targetDefaults ?? {}).flatMap(([name, target]) =>
      located(`nx.json targetDefaults ${name}`, null, target.inputs)
    ),
    ...Object.entries(nx.namedInputs ?? {}).flatMap(([name, inputs]) =>
      located(`nx.json namedInputs ${name}`, null, inputs)
    ),
  ];
}

/** The workspace path an input names, or `null` when it names no one file. */
function namedFile({ projectRoot, input }) {
  // Tested before `join`, which would normalise `**/..` away with the glob.
  if (
    GLOB_CHARACTERS.test(input.replace(/^\{(workspace|project)Root\}\//, ''))
  ) {
    return null;
  }
  if (input.startsWith(WORKSPACE_ROOT)) {
    return input.slice(WORKSPACE_ROOT.length);
  }
  if (input.startsWith(PROJECT_ROOT) && projectRoot !== null) {
    return join(projectRoot, input.slice(PROJECT_ROOT.length));
  }
  return null;
}

function namesMissingFile(located) {
  const path = namedFile(located);
  return path !== null && !existsSync(join(ROOT, path));
}

const INPUTS = allInputs();

void describe('the input check', () => {
  const inProject = (input) => ({ where: 'x', projectRoot: 'tools', input });

  void it('takes the patterns of strings and filesets, not other objects', () => {
    assert.deepEqual(
      filePatterns([
        'production',
        { fileset: '{projectRoot}/a.json' },
        { runtime: 'node -v' },
        { env: 'CI' },
      ]),
      ['production', '{projectRoot}/a.json']
    );
  });

  void it('resolves {projectRoot} against the project folder', () => {
    assert.equal(
      namedFile(inProject('{projectRoot}/project.json')),
      join('tools', 'project.json')
    );
    assert.equal(
      namesMissingFile(inProject('{projectRoot}/project.json')),
      false
    );
    assert.equal(
      namesMissingFile(inProject('{projectRoot}/no-such-file.json')),
      true
    );
  });

  void it('resolves {workspaceRoot} against the workspace', () => {
    assert.equal(namesMissingFile(inProject('{workspaceRoot}/nx.json')), false);
    assert.equal(
      namesMissingFile(inProject('{workspaceRoot}/no-such-file.json')),
      true
    );
  });

  void it('leaves out globs, negations, named inputs and nx.json project roots', () => {
    for (const input of [
      '{projectRoot}/**/*.ts',
      '{projectRoot}/**/../missing.json',
      '!{projectRoot}/missing.ts',
      '{workspaceRoot}/missing/*.json',
      'production',
      '^production',
    ]) {
      assert.equal(namedFile(inProject(input)), null, input);
    }
    assert.equal(
      namedFile({
        where: 'nx.json',
        projectRoot: null,
        input: '{projectRoot}/missing.json',
      }),
      null
    );
  });
});

void describe('target inputs', () => {
  void it('never use {projectName}, which Nx leaves unresolved in inputs', () => {
    const unresolved = INPUTS.filter(({ input }) =>
      input.includes(PROJECT_NAME)
    ).map(({ where, input }) => `${where}: ${input}`);
    assert.deepEqual(unresolved, []);
  });

  void it('name only files that exist', () => {
    const missing = INPUTS.filter(namesMissingFile).map(
      ({ where, input }) => `${where}: ${input}`
    );
    assert.deepEqual(missing, []);
  });
});

void describe('the CI workflow', () => {
  void it('runs this guard on every run, outside the affected tasks', () => {
    const step = stepBlock(
      readFileSync(join(ROOT, CI_WORKFLOW), 'utf8'),
      GUARD_STEP_NAME
    );
    assert.ok(step, `${CI_WORKFLOW} has no step "${GUARD_STEP_NAME}"`);
    assert.ok(step.includes(GUARD_COMMAND), step);
    assert.doesNotMatch(step, SKIPPING_KEYS);
  });
});
