// Keeps every spec project's specs type-checked (#2822, #3131). Jest and
// Vitest run specs transpile-only, so a fake or a call in a spec drifts from
// the real types unnoticed unless `typecheck-specs` runs among CI's affected
// targets. The local plugin tools/nx/typecheck-specs.mjs infers it for every
// project with a tsconfig.spec.json, whether its test target is written or
// inferred; its own spec checks the target it builds. This one checks that
// nx.json registers it as the one source of the target, that a project.json
// adds no more than a `dependsOn`, and that every spec tsconfig lies in a
// project the plugin reaches.
import assert from 'node:assert/strict';
import { dirname } from 'node:path';
import { describe, it } from 'node:test';
import { createNodes } from '../nx/typecheck-specs.mjs';
import {
  gitLsFiles,
  readJson,
  readProjects,
  ROOT,
} from './workspace-projects.mjs';

const PLUGIN = './tools/nx/typecheck-specs.mjs';
const TARGET = 'typecheck-specs';

function pluginName(entry) {
  return typeof entry === 'string' ? entry : entry.plugin;
}

void describe('typecheck-specs', () => {
  void it('is inferred by the local plugin, not set in targetDefaults', () => {
    const nxJson = readJson('nx.json');
    const entries = nxJson.plugins.filter(
      (entry) => pluginName(entry) === PLUGIN
    );
    assert.equal(entries.length, 1, `register ${PLUGIN} once in nx.json`);
    assert.equal(
      nxJson.targetDefaults?.[TARGET],
      undefined,
      `the plugin owns ${TARGET}; drop it from targetDefaults`
    );
  });

  void it('takes no more than a dependsOn from a project.json', () => {
    const overriding = readProjects()
      .filter(({ json }) => json.targets?.[TARGET])
      .filter(({ json }) =>
        Object.keys(json.targets[TARGET]).some((key) => key !== 'dependsOn')
      )
      .map(({ path }) => path);
    assert.deepEqual(
      overriding,
      [],
      `leave ${TARGET} to the plugin; a project.json adds a dependsOn at most`
    );
  });

  void it('reaches every tracked tsconfig.spec.json', async () => {
    const specTsconfigs = gitLsFiles('**/tsconfig.spec.json');
    const [, inferTargets] = createNodes;
    const results = await inferTargets(specTsconfigs, undefined, {
      workspaceRoot: ROOT,
      nxJsonConfiguration: readJson('nx.json'),
    });
    const reached = new Set(results.map(([file]) => file));
    const unreached = specTsconfigs.filter((file) => !reached.has(file));
    assert.deepEqual(
      unreached.map(dirname),
      [],
      'a spec tsconfig outside a project root is never type-checked'
    );
  });
});
