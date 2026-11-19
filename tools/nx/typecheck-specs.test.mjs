// Spec of the local Nx plugin that infers `typecheck-specs` (#3131). Each case
// lays out a workspace in a temp folder and runs the plugin's createNodes on
// it, as Nx does with the files matching its pattern. `describe` and `it`
// return promises `node:test` awaits itself, hence the `void`.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, matchesGlob } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { createNodes } from './typecheck-specs.mjs';

const [pattern, inferTargets] = createNodes;
const SPEC_TSCONFIG = 'libs/utils/a/tsconfig.spec.json';

let workspaceRoot;

before(() => {
  workspaceRoot = mkdtempSync(join(tmpdir(), 'typecheck-specs-'));
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

async function infer(files, specTsconfigs, options) {
  const caseRoot = layOut(files);
  const results = await inferTargets(
    specTsconfigs.map((file) => `${caseRoot}/${file}`),
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

void describe('typecheck-specs plugin', () => {
  void it('matches every tsconfig.spec.json', () => {
    assert.ok(matchesGlob(SPEC_TSCONFIG, pattern));
    assert.ok(matchesGlob('apps/app/tsconfig.spec.json', pattern));
    assert.ok(!matchesGlob('libs/utils/a/tsconfig.lib.json', pattern));
  });

  void it('runs tsc on the spec tsconfig of a project.json project, cached', async () => {
    const results = await infer(
      ['libs/utils/a/project.json', SPEC_TSCONFIG],
      [SPEC_TSCONFIG]
    );
    assert.deepEqual(results, [
      [
        SPEC_TSCONFIG,
        {
          'libs/utils/a': {
            targets: {
              'typecheck-specs': {
                command: 'tsc -p {projectRoot}/tsconfig.spec.json --noEmit',
                inputs: [
                  'default',
                  '^production',
                  '{workspaceRoot}/tsconfig.base.json',
                ],
                cache: true,
              },
            },
          },
        },
      ],
    ]);
  });

  void it('infers it for a package.json project too', async () => {
    const results = await infer(
      ['libs/utils/a/package.json', SPEC_TSCONFIG],
      [SPEC_TSCONFIG]
    );
    assert.deepEqual(Object.keys(results[0][1]), ['libs/utils/a']);
  });

  void it('skips a tsconfig.spec.json without a project beside it', async () => {
    const results = await infer([SPEC_TSCONFIG], [SPEC_TSCONFIG]);
    assert.deepEqual(results, []);
  });

  void it('names the target after the targetName option', async () => {
    const results = await infer(
      ['libs/utils/a/project.json', SPEC_TSCONFIG],
      [SPEC_TSCONFIG],
      { targetName: 'spec-types' }
    );
    assert.deepEqual(Object.keys(results[0][1]['libs/utils/a'].targets), [
      'spec-types',
    ]);
  });
});
