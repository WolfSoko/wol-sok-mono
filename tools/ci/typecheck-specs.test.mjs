// Keeps every spec project's specs type-checked (#2822, #3131). Jest and
// Vitest run specs transpile-only, so a fake or a call in a spec drifts from
// the real types unnoticed unless `typecheck-specs` runs among CI's affected
// targets. The local plugin tools/nx/typecheck-specs.mjs infers it for every
// project with a tsconfig.spec.json, whether its test target is written or
// inferred; its own spec checks the target it builds. This one checks that
// nx.json registers it as the one source of the target, that a project.json
// adds no more than a `dependsOn`, that every spec tsconfig lies in a project
// the plugin reaches unless the plugin entry's `exclude` names it, and that
// every inferred command names an existing spec tsconfig. Nx's `affected`
// names only `tools` for a change of the plugin, so this test is what CI runs
// on such a change; run `npx nx run-many -t typecheck-specs` by hand too.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname, join, matchesGlob } from 'node:path';
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

  void it('reaches every tracked tsconfig.spec.json not excluded in nx.json', async () => {
    const unreached = (await inferredProjects())
      .filter(({ projects }) => projects === undefined)
      .map(({ file }) => file)
      .filter((file) => !matchesAny(file, pluginEntry().exclude));
    assert.deepEqual(
      unreached.map(dirname),
      [],
      'a spec tsconfig outside a project root is never type-checked; ' +
        "list a deliberate gap in the plugin entry's exclude"
    );
  });

  void it('points every inferred command at an existing spec tsconfig', async () => {
    const broken = (await inferredProjects())
      .flatMap(({ projects }) => Object.entries(projects ?? {}))
      .map(([root, { targets }]) =>
        targets[TARGET].command.replaceAll('{projectRoot}', root)
      )
      .filter((command) => !existsSync(join(ROOT, tsconfigOf(command))));
    assert.deepEqual(broken, [], 'the -p path of the command names no file');
  });
});

function pluginEntry() {
  const entry = readJson('nx.json').plugins.find(
    (candidate) => pluginName(candidate) === PLUGIN
  );
  return typeof entry === 'string' ? { plugin: entry } : entry;
}

function matchesAny(file, globs = []) {
  return globs.some((glob) => matchesGlob(file, glob));
}

/** Nx's view: the plugin's result for each tracked spec tsconfig it is given. */
async function inferredProjects() {
  const { include, exclude, options } = pluginEntry();
  const given = gitLsFiles('**/tsconfig.spec.json').filter(
    (file) =>
      (include === undefined || matchesAny(file, include)) &&
      !matchesAny(file, exclude)
  );
  const [, inferTargets] = createNodes;
  const results = new Map(
    await inferTargets(given, options, {
      workspaceRoot: ROOT,
      nxJsonConfiguration: readJson('nx.json'),
    })
  );
  return gitLsFiles('**/tsconfig.spec.json').map((file) => ({
    file,
    projects: results.get(file)?.projects,
  }));
}

function tsconfigOf(command) {
  return command.match(/-p (\S+)/)[1];
}
