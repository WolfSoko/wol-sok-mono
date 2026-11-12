// Keeps target inputs pointing at real files (#2946). Nx matches an input
// that names a missing file against nothing and reports nothing, so a typo
// (`jest.preset.js` for `jest.preset.cjs`) or a renamed file silently drops
// the input. Nx also leaves `{projectName}` unresolved in inputs (#2904).
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  ROOT,
  readJson,
  readProjects,
  stringInputs,
} from './workspace-projects.mjs';

const WORKSPACE_ROOT = '{workspaceRoot}/';
const PROJECT_NAME = '{projectName}';
// A path holding one of these is a pattern, not a single file.
const GLOB_CHARACTERS = /[*?{}[\]!]/;

/** The string inputs of one list, each with where it was found. */
function located(where, inputs) {
  return stringInputs(inputs).map((input) => ({ where, input }));
}

/** Every string input as `{ where, input }`, from projects and nx.json. */
function allInputs() {
  const nx = readJson('nx.json');
  return [
    ...readProjects().flatMap(({ path, json }) =>
      Object.entries(json.targets ?? {}).flatMap(([name, target]) =>
        located(`${path} ${name}`, target.inputs)
      )
    ),
    ...Object.entries(nx.targetDefaults ?? {}).flatMap(([name, target]) =>
      located(`nx.json targetDefaults ${name}`, target.inputs)
    ),
    ...Object.entries(nx.namedInputs ?? {}).flatMap(([name, inputs]) =>
      located(`nx.json namedInputs ${name}`, inputs)
    ),
  ];
}

function namesMissingFile(input) {
  if (!input.startsWith(WORKSPACE_ROOT)) return false;
  const path = input.slice(WORKSPACE_ROOT.length);
  return !GLOB_CHARACTERS.test(path) && !existsSync(join(ROOT, path));
}

const INPUTS = allInputs();

void describe('target inputs', () => {
  void it('never use {projectName}, which Nx leaves unresolved in inputs', () => {
    const unresolved = INPUTS.filter(({ input }) =>
      input.includes(PROJECT_NAME)
    ).map(({ where, input }) => `${where}: ${input}`);
    assert.deepEqual(unresolved, []);
  });

  void it('name only workspace files that exist', () => {
    const missing = INPUTS.filter(({ input }) => namesMissingFile(input)).map(
      ({ where, input }) => `${where}: ${input}`
    );
    assert.deepEqual(missing, []);
  });
});
