// Keeps target inputs pointing at real files (#2946). Nx matches an input
// that names a missing file against nothing and reports nothing, so a typo
// (`jest.preset.js` for `jest.preset.cjs`) or a renamed file silently drops
// the input. Nx also leaves `{projectName}` unresolved in inputs (#2904).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const ROOT = join(import.meta.dirname, '..', '..');
const WORKSPACE_ROOT = '{workspaceRoot}/';
const PROJECT_NAME = '{projectName}';
// A path holding one of these is a pattern, not a single file.
const GLOB_CHARACTERS = /[*?{}[\]!]/;

function readJson(path) {
  return JSON.parse(readFileSync(join(ROOT, path), 'utf8'));
}

function projectFiles() {
  return execFileSync('git', ['ls-files', 'project.json', '**/project.json'], {
    cwd: ROOT,
    encoding: 'utf8',
  })
    .split('\n')
    .filter((path) => path !== '');
}

/** Every string input as `{ where, input }`, from projects and nx.json. */
function allInputs() {
  const fromProjects = projectFiles().flatMap((path) =>
    Object.entries(readJson(path).targets ?? {}).flatMap(([name, target]) =>
      stringInputs(target.inputs).map((input) => ({
        where: `${path} ${name}`,
        input,
      }))
    )
  );
  const nx = readJson('nx.json');
  const fromTargetDefaults = Object.entries(nx.targetDefaults ?? {}).flatMap(
    ([name, target]) =>
      stringInputs(target.inputs).map((input) => ({
        where: `nx.json targetDefaults ${name}`,
        input,
      }))
  );
  const fromNamedInputs = Object.entries(nx.namedInputs ?? {}).flatMap(
    ([name, inputs]) =>
      stringInputs(inputs).map((input) => ({
        where: `nx.json namedInputs ${name}`,
        input,
      }))
  );
  return [...fromProjects, ...fromTargetDefaults, ...fromNamedInputs];
}

function stringInputs(inputs) {
  return (inputs ?? []).filter((input) => typeof input === 'string');
}

function namesMissingFile(input) {
  if (!input.startsWith(WORKSPACE_ROOT)) return false;
  const path = input.slice(WORKSPACE_ROOT.length);
  return !GLOB_CHARACTERS.test(path) && !existsSync(join(ROOT, path));
}

const INPUTS = allInputs();

describe('target inputs', () => {
  it('never use {projectName}, which Nx leaves unresolved in inputs', () => {
    const unresolved = INPUTS.filter(({ input }) =>
      input.includes(PROJECT_NAME)
    ).map(({ where, input }) => `${where}: ${input}`);
    assert.deepEqual(unresolved, []);
  });

  it('name only workspace files that exist', () => {
    const missing = INPUTS.filter(({ input }) => namesMissingFile(input)).map(
      ({ where, input }) => `${where}: ${input}`
    );
    assert.deepEqual(missing, []);
  });
});
