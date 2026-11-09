// Keeps the Nx Cloud workers' setup in step with what CI runs on them (#2960).
// Plain text checks: the workspace declares no YAML parser.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const ROOT = join(import.meta.dirname, '..', '..');
const WORKERS = '.nx/workflows/workers.yml';
const CI_CONFIG = '.nx/ci-config.yaml';
const CI_WORKFLOW = '.github/workflows/ci-cd.yml';

// The emulators the Firebase CLI downloads on first use (a jar or a binary);
// auth, functions, hosting and the hub run from the CLI itself.
const DOWNLOADED_EMULATORS = [
  'firestore',
  'database',
  'pubsub',
  'storage',
  'dataconnect',
];

function sorted(names) {
  return [...names].sort((a, b) => a.localeCompare(b));
}

function read(path) {
  return readFileSync(join(ROOT, path), 'utf8');
}

function firebaseConfigs() {
  return execFileSync('git', ['ls-files', '*.json'], {
    cwd: ROOT,
    encoding: 'utf8',
  })
    .split('\n')
    .filter((path) => path !== '' && !path.includes('node_modules/'))
    .map((path) => ({ path, json: parseJson(path) }))
    .filter(({ json }) => typeof json?.emulators === 'object');
}

function parseJson(path) {
  try {
    return JSON.parse(read(path));
  } catch {
    return undefined;
  }
}

function emulatorsInUse() {
  const used = new Set();
  for (const { json } of firebaseConfigs()) {
    for (const name of Object.keys(json.emulators)) {
      if (DOWNLOADED_EMULATORS.includes(name)) used.add(name);
    }
  }
  return sorted(used);
}

function stopAfterTargets() {
  const block = read(CI_CONFIG).match(/stop-after:\n((?:\s+(?:-.*|#.*)\n?)+)/);
  assert.ok(block, `${CI_CONFIG} has no stop-after list`);
  return sorted([...block[1].matchAll(/^\s+-\s+(\S+)/gm)].map((m) => m[1]));
}

function affectedTargets() {
  const call = read(CI_WORKFLOW).match(/nx affected -t="([^"]+)"/);
  assert.ok(call, `${CI_WORKFLOW} has no nx affected -t call`);
  return sorted(call[1].split(','));
}

describe('Nx Cloud workers', () => {
  it('finds the Firebase configs of the emulator suites', () => {
    assert.ok(emulatorsInUse().includes('firestore'));
  });

  it('download every emulator a Firebase config uses after npm install, before any task', () => {
    const workers = read(WORKERS);
    const install = workers.indexOf('npm install');
    assert.ok(install >= 0, `${WORKERS} runs no npm install`);
    for (const name of emulatorsInUse()) {
      const download = workers.indexOf(`firebase setup:emulators:${name}`);
      assert.ok(
        download > install,
        `${WORKERS} must run "npx firebase setup:emulators:${name}" after npm install`
      );
    }
  });

  it('stay until every target of the CI call is done', () => {
    assert.deepEqual(stopAfterTargets(), affectedTargets());
  });
});
