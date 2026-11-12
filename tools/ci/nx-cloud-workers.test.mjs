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
const DOWNLOAD_STEP = 'Download the Firebase emulators';
// POSIX, since Nx Cloud documents no shell for inline scripts: a dash would
// stop on `set -o pipefail` itself.
const FAIL_FAST = 'set -eu';
const DOWNLOAD_COMMAND = 'npx firebase setup:emulators:';

// The emulators the Firebase CLI downloads on first use (a jar, a binary or
// the UI's zip); auth, functions, hosting and the hub run from the CLI itself.
const DOWNLOADED_EMULATORS = [
  'firestore',
  'database',
  'pubsub',
  'storage',
  'dataconnect',
  'ui',
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
    .filter(({ json }) => isObject(json?.emulators));
}

function isObject(value) {
  return typeof value === 'object' && value !== null;
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
    for (const name of downloadedBy(json.emulators)) used.add(name);
  }
  return sorted(used);
}

function downloadedBy(emulators) {
  const names = Object.keys(emulators).filter(
    (name) => name !== 'ui' && DOWNLOADED_EMULATORS.includes(name)
  );
  // The CLI starts the UI unless a config switches it off.
  return emulators.ui?.enabled === false ? names : [...names, 'ui'];
}

// The template's lines without comments, so a commented-out command counts as
// missing.
function executableLines(yaml) {
  return yaml
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));
}

// The script of one init step: where its name stands among the template's
// executable lines, and the commands below its `script:` header.
function stepScript(lines, name) {
  const start = lines.indexOf(`- name: ${name}`);
  assert.ok(start >= 0, `${WORKERS} has no step "${name}"`);
  const next = lines.findIndex(
    (line, index) => index > start && line.startsWith('- name:')
  );
  const step = lines.slice(start + 1, next < 0 ? undefined : next);
  const header = step.findIndex((line) => line.startsWith('script:'));
  assert.ok(header >= 0, `"${name}" in ${WORKERS} has no script`);
  return { start, commands: step.slice(header + 1) };
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

void describe('Nx Cloud workers', () => {
  void it('finds the Firebase configs of the emulator suites', () => {
    assert.ok(emulatorsInUse().includes('firestore'));
  });

  void it('download every emulator a Firebase config uses in the download step, after npm install', () => {
    const lines = executableLines(read(WORKERS));
    const install = lines.indexOf('npm install');
    assert.ok(install >= 0, `${WORKERS} runs no npm install`);
    const { start, commands } = stepScript(lines, DOWNLOAD_STEP);
    assert.ok(
      start > install,
      `"${DOWNLOAD_STEP}" in ${WORKERS} must come after npm install`
    );
    for (const name of emulatorsInUse()) {
      assert.ok(
        commands.includes(`${DOWNLOAD_COMMAND}${name}`),
        `"${DOWNLOAD_STEP}" in ${WORKERS} must run "${DOWNLOAD_COMMAND}${name}"`
      );
    }
  });

  void it('download the emulators only in a step that stops on the first failed download', () => {
    const lines = executableLines(read(WORKERS));
    const { commands } = stepScript(lines, DOWNLOAD_STEP);
    assert.equal(
      commands[0],
      FAIL_FAST,
      `"${DOWNLOAD_STEP}" in ${WORKERS} must start its script with "${FAIL_FAST}"`
    );
    const everywhere = lines.filter((line) =>
      line.startsWith(DOWNLOAD_COMMAND)
    );
    const inStep = commands.filter((line) => line.startsWith(DOWNLOAD_COMMAND));
    assert.deepEqual(
      everywhere,
      inStep,
      `${WORKERS} must run every "${DOWNLOAD_COMMAND}…" in "${DOWNLOAD_STEP}"`
    );
  });

  void it('stay until every target of the CI call is done', () => {
    assert.deepEqual(stopAfterTargets(), affectedTargets());
  });
});
