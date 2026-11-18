// Every script under tools/ belongs to the program of tools/tsconfig.json
// (#3074). Type-aware oxlint types a file in the program of its nearest
// tsconfig.json; a file that program leaves out lands in a fallback program
// built from whatever other unowned files the same run lints, so its
// type-aware findings changed between `nx lint tools` and a batched lint run.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join, relative } from 'node:path';
import { describe, it } from 'node:test';
import ts from 'typescript';
import { ROOT } from './workspace-projects.mjs';

const TOOLS_TSCONFIG = 'tools/tsconfig.json';
const SCRIPT_FILE = /\.[cm]?[jt]s$/;

function trackedScripts() {
  return execFileSync('git', ['ls-files', 'tools'], {
    cwd: ROOT,
    encoding: 'utf8',
  })
    .split('\n')
    .filter((path) => SCRIPT_FILE.test(path) && !path.endsWith('.d.ts'));
}

function nestedTsconfigs() {
  return execFileSync('git', ['ls-files', 'tools/**/tsconfig.json'], {
    cwd: ROOT,
    encoding: 'utf8',
  })
    .split('\n')
    .filter((path) => path !== '');
}

function filesOf(tsconfigPath) {
  const parsed = ts.getParsedCommandLineOfConfigFile(
    join(ROOT, tsconfigPath),
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
        throw new Error(
          ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
        );
      },
    }
  );
  return new Set(parsed.fileNames.map((file) => relative(ROOT, file)));
}

void describe('tools/tsconfig.json', () => {
  void it('owns every script under tools/, so type-aware lint types it the same on every run', () => {
    const owned = filesOf(TOOLS_TSCONFIG);
    const unowned = trackedScripts().filter((path) => !owned.has(path));
    assert.deepEqual(
      unowned,
      [],
      `${TOOLS_TSCONFIG} must include these files (widen its "include")`
    );
  });

  void it('is the only tsconfig.json under tools/, or the check above misses files', () => {
    assert.deepEqual(
      nestedTsconfigs(),
      [],
      `a nested tsconfig.json takes its folder from ${TOOLS_TSCONFIG}: extend this test to check that it owns its folder's scripts`
    );
  });
});
