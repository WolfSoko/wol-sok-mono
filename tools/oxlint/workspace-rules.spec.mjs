/**
 * Runs the workspace rules through the workspace's own oxlint, as CI lints
 * with them: each case is a file in a temp folder, linted with a config that
 * loads only this plugin.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { deepStrictEqual } from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const oxlint = join(here, '../../node_modules/.bin/oxlint');
const VERSION_RULE = 'wolsok(no-version-json-read)';

let folder;
let caseCount = 0;

before(() => {
  folder = mkdtempSync(join(tmpdir(), 'workspace-rules-'));
  writeFileSync(
    join(folder, '.oxlintrc.json'),
    JSON.stringify({
      categories: { correctness: 'off' },
      jsPlugins: [join(here, 'workspace-rules.mjs')],
      rules: { 'wolsok/no-version-json-read': 'error' },
    })
  );
});

after(() => rmSync(folder, { recursive: true, force: true }));

/** The codes oxlint reports for `source`, linted as a TypeScript file. */
function reportedCodes(source) {
  const file = `case-${caseCount++}.ts`;
  writeFileSync(join(folder, file), source);
  // oxlint exits non-zero on an error; the JSON report is the same.
  let output;
  try {
    output = execFileSync(
      oxlint,
      ['-c', '.oxlintrc.json', '-f', 'json', file],
      {
        cwd: folder,
        encoding: 'utf8',
      }
    );
  } catch (error) {
    output = error.stdout;
  }
  return JSON.parse(output).diagnostics.map((diagnostic) => diagnostic.code);
}

describe('wolsok/no-version-json-read', () => {
  const reads = [
    "readFileSync(join(process.cwd(), 'version.json'), 'utf8');",
    "readFileSync('version.json');",
    'readFile(`${root}/version.json`);',
    "fs.promises.readFile('./version.json');",
    "readJson('version.json');",
    "readFileSync(root + '/version.json');",
    "readFileSync('C:\\\\repo\\\\version.json');",
    "import { version } from '../../version.json';",
    "export { version } from '../version.json';",
    "export * from '../version.json';",
    "void import('../version.json');",
    "require('../../version.json');",
  ];
  for (const source of reads) {
    it(`reports ${source}`, () => {
      deepStrictEqual(reportedCodes(source), [VERSION_RULE]);
    });
  }

  const allowed = [
    "Source.jsonData('version.json', version);",
    'throw new Error(\'version.json has no string "version"\');',
    "import { WORKSPACE_VERSION } from '@wolsok/utils-version';",
    "readFileSync('package-version.json');",
    "readFileSync('version.json.bak');",
    "const path = 'version.json';",
    "writeFileSync('version.json', '{}');",
    '// readFileSync(version.json) is not allowed here',
  ];
  for (const source of allowed) {
    it(`allows ${source}`, () => {
      deepStrictEqual(reportedCodes(source), []);
    });
  }
});
