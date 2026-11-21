// Keeps the lockfile an input of every oxlint `lint` (#3151). Type-aware
// oxlint reads the types of installed packages, but for `@nx/oxlint:lint` Nx
// hashes only the executor's own dependency closure and the packages a
// project and its dependencies import, and ignores `externalDependencies` on
// an executor target, so a type package only a tsconfig names (`@types/jest`)
// is in no lint hash. nx.json's targetDefaults entry for the executor appends
// the lockfile to every inferred target through Nx's `'...'` spread; a
// project.json whose `lint` inputs neither spread nor name it would drop it
// again. The root project's hand-written target is checked by root-lint.test.mjs.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  LOCKFILE_INPUT,
  readJson,
  readProjects,
} from './workspace-projects.mjs';

const LINT_EXECUTOR = '@nx/oxlint:lint';
const SPREAD = '...';

void describe('the lockfile as a lint input', () => {
  void it('is appended to every oxlint target by targetDefaults', () => {
    assert.deepEqual(
      readJson('nx.json').targetDefaults?.[LINT_EXECUTOR]?.inputs,
      [SPREAD, LOCKFILE_INPUT]
    );
  });

  void it('is kept by every project.json that sets lint inputs', () => {
    const dropping = readProjects()
      .filter(({ json }) => {
        const inputs = json.targets?.lint?.inputs;
        return (
          inputs && !inputs.includes(SPREAD) && !inputs.includes(LOCKFILE_INPUT)
        );
      })
      .map(({ path }) => path);
    assert.deepEqual(dropping, [], `spread '${SPREAD}' or name the lockfile`);
  });
});
