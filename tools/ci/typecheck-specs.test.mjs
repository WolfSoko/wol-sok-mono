// Keeps every spec project's specs type-checked (#2822). Jest and Vitest run
// specs transpile-only, so a fake or a call in a spec drifts from the real
// types unnoticed unless `typecheck-specs` (command, inputs and caching from
// nx.json's targetDefaults) runs among CI's affected targets. A project with a
// `test` target and a tsconfig.spec.json therefore has one.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { readJson, readProjects, ROOT } from './workspace-projects.mjs';

const SPEC_TSCONFIG = 'tsconfig.spec.json';

function hasSpecTsconfig(project) {
  return existsSync(join(ROOT, dirname(project.path), SPEC_TSCONFIG));
}

void describe('typecheck-specs', () => {
  void it('is a target of every project with a test target and a tsconfig.spec.json', () => {
    const missing = readProjects()
      .filter(({ json }) => json.targets?.test)
      .filter(hasSpecTsconfig)
      .filter(({ json }) => !json.targets['typecheck-specs'])
      .map(({ path }) => path);
    assert.deepEqual(missing, [], 'add "typecheck-specs": {} to their targets');
  });

  void it('runs tsc on the project tsconfig.spec.json by default', () => {
    const { command } = readJson('nx.json').targetDefaults['typecheck-specs'];
    assert.equal(command, `tsc -p {projectRoot}/${SPEC_TSCONFIG} --noEmit`);
  });
});
