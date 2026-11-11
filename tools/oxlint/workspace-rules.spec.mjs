/**
 * Runs the workspace rules through the workspace's own oxlint, as CI lints
 * with them: each case is a file in a temp folder, linted with a config that
 * loads only this plugin. `describe` and `it` return promises `node:test`
 * awaits itself, hence the `void`.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { deepStrictEqual } from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// The package's own entry, run by this Node: the `.bin` shim is no executable
// on Windows.
const oxlint = join(here, '../../node_modules/oxlint/bin/oxlint');
const VERSION_RULE = 'wolsok(no-version-json-read)';
const TESTING_RULE = 'wolsok(no-testing-import)';

let folder;
let caseCount = 0;

before(() => {
  folder = mkdtempSync(join(tmpdir(), 'workspace-rules-'));
  writeFileSync(
    join(folder, '.oxlintrc.json'),
    JSON.stringify({
      categories: { correctness: 'off' },
      jsPlugins: [join(here, 'workspace-rules.mjs')],
      rules: {
        'wolsok/no-version-json-read': 'error',
        'wolsok/no-testing-import': 'error',
      },
    })
  );
});

after(() => rmSync(folder, { recursive: true, force: true }));

/**
 * The codes oxlint reports for `source`, linted as a TypeScript file, or as
 * `name` (a path inside the case's own folder, say `testing/fake.ts`) where
 * the file's name matters; `parent` is a folder above the workspace oxlint
 * runs in.
 */
function reportedCodes(source, name = 'case.ts', parent = '') {
  const file = join(`case-${caseCount++}`, name);
  const root = join(folder, parent);
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), source);
  // oxlint exits non-zero on an error; the JSON report is the same.
  let output;
  try {
    output = execFileSync(
      process.execPath,
      [oxlint, '-c', join(folder, '.oxlintrc.json'), '-f', 'json', file],
      {
        cwd: root,
        encoding: 'utf8',
      }
    );
  } catch (error) {
    // A failed start (no oxlint, a crash) has no report: show its own error.
    if (!error.stdout) {
      throw error;
    }
    output = error.stdout;
  }
  return JSON.parse(output).diagnostics.map((diagnostic) => diagnostic.code);
}

void describe('wolsok/no-version-json-read', () => {
  const reads = [
    "readFileSync(join(process.cwd(), 'version.json'), 'utf8');",
    "readFileSync('version.json');",
    'readFile(`${root}/version.json`);',
    "fs.promises.readFile('./version.json');",
    "readJson('version.json');",
    "readFileSync(new URL('../version.json', import.meta.url));",
    "fs['readFileSync']('version.json');",
    "readFileSync(join(root, 'version.json')!);",
    "readFileSync(useLib ? 'other.json' : 'version.json');",
    "readFileSync(root + '/version.json');",
    "readFileSync('C:\\\\repo\\\\version.json');",
    "import { version } from '../../version.json';",
    "export { version } from '../version.json';",
    "export * from '../version.json';",
    "void import('../version.json');",
    "require('../../version.json');",
    "import version = require('../../version.json');",
    "export type Version = import('../../version.json').default;",
  ];
  for (const source of reads) {
    void it(`reports ${source}`, () => {
      deepStrictEqual(reportedCodes(source), [VERSION_RULE]);
    });
  }

  const allowed = [
    "Source.jsonData('version.json', version);",
    'throw new Error(\'version.json has no string "version"\');',
    "import { WORKSPACE_VERSION } from '@wolsok/utils-version';",
    "readFileSync('package-version.json');",
    "readFileSync('version.json.bak');",
    'readFileSync(`version.json${extension}`);',
    "readme('version.json');",
    "readFileSync(existsSync('version.json') ? 'a.json' : 'b.json');",
    "const path = 'version.json';",
    "writeFileSync('version.json', '{}');",
    '// readFileSync(version.json) is not allowed here',
  ];
  for (const source of allowed) {
    void it(`allows ${source}`, () => {
      deepStrictEqual(reportedCodes(source), []);
    });
  }
});

void describe('wolsok/no-testing-import', () => {
  const imports = [
    "import { FakeFirebase } from '@wolsok/feat-lazy-bac-game/testing';",
    "import type { FakeDoc } from '@wolsok/feat-lazy-bac-game/testing';",
    "import { recordedReplay } from '@wolsok/feat-shared-bacteria-engine/testing';",
    "import { fakeDbbAnswer } from '@wolsok/feat-shared-basketball-data/testing/fake-dbb';",
    "export { RecordingAnalytics } from '@wolsok/shared-analytics/testing';",
    "export * from '@wolsok/feat-korbjaeger-selection/testing';",
    "void import('@wolsok/feat-lazy-bac-game/testing');",
    "require('@wolsok/feat-lazy-bac-game/testing');",
    "export type Fake = import('@wolsok/feat-lazy-bac-game/testing').FakeDoc;",
    "import fake = require('@wolsok/feat-lazy-bac-game/testing');",
    "import { useEmulatorDb } from '../testing/emulator';",
    "import { fakeSelection } from './testing';",
    "import { zeigen } from '../../testing/zeigen.ts';",
  ];
  for (const source of imports) {
    void it(`reports ${source}`, () => {
      deepStrictEqual(reportedCodes(source), [TESTING_RULE]);
    });
  }

  const allowedImports = [
    "import { TestBed } from '@angular/core/testing';",
    "import { provideHttpClientTesting } from '@angular/common/http/testing';",
    "import { GameCloud } from '@wolsok/feat-lazy-bac-game';",
    "import { watch } from '@wolsok/feat-lazy-bac-game/watch';",
    "import { testingMode } from './testing-mode';",
    "import { x } from '../attesting/x';",
    "const path = '../testing/emulator';",
  ];
  for (const source of allowedImports) {
    void it(`allows ${source}`, () => {
      deepStrictEqual(reportedCodes(source), []);
    });
  }

  const testFiles = [
    'game.component.spec.ts',
    'replay.test.ts',
    'boards.emulator.ts',
    'draw-digit.component.cy.ts',
    'repository.factory.mock.ts',
    'test-setup.ts',
    'testing.ts',
    'testing/fake-game-cloud.ts',
    'app/konto/testing/fake-konto-dienst.ts',
  ];
  for (const name of testFiles) {
    void it(`allows testing imports in ${name}`, () => {
      deepStrictEqual(
        reportedCodes(
          "import { fakeSelection } from '@wolsok/feat-korbjaeger-selection/testing';",
          name
        ),
        []
      );
    });
  }

  void it('judges a file by its path inside the workspace, not above it', () => {
    // The temp folder itself may sit below a `testing` folder; the case's
    // own folder is named so here, which the rule must not take as test code.
    deepStrictEqual(
      reportedCodes(
        "import { fakeSelection } from '@wolsok/feat-korbjaeger-selection/testing';",
        'prod.ts',
        'testing'
      ),
      [TESTING_RULE]
    );
  });
});
