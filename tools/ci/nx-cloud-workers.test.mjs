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
// Every inline init script starts with it (#2974, #3067). POSIX, since Nx Cloud
// documents neither the shell nor fail-fast for inline scripts: a dash would
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

// The template's init steps: each starts at a list item (`- `), whichever key
// comes first, so no step hides inside the one before it. `start` is the
// step's index among the executable lines; `script` holds the commands of an
// inline script (a block below `script: |` or a one-line `script: …`), or is
// undefined for a reusable step.
function initSteps(lines) {
  const steps = [];
  lines.forEach((line, index) => {
    if (line.startsWith('- ')) steps.push({ start: index, lines: [] });
    steps
      .at(-1)
      ?.lines.push(index === steps.at(-1).start ? line.slice(2) : line);
  });
  return steps.map(({ start, lines: step }) => ({
    start,
    name: step
      .find((line) => line.startsWith('name:'))
      ?.match(/^name:\s*(.*?)(?:\s+#.*)?$/)[1],
    script: scriptOf(step),
  }));
}

function scriptOf(step) {
  const header = step.findIndex((line) => line.startsWith('script:'));
  if (header < 0) return undefined;
  const inline = step[header].slice('script:'.length).trim();
  // A folded block (`>`) joins its lines into one command, so `set -eu` would
  // swallow the rest as arguments.
  assert.ok(
    !inline.startsWith('>'),
    `${WORKERS} must write an inline script as a literal block (\`script: |\`)`
  );
  return inline.startsWith('|') ? step.slice(header + 1) : [inline];
}

function stepNamed(lines, name) {
  const step = initSteps(lines).find((candidate) => candidate.name === name);
  assert.ok(step, `${WORKERS} has no step "${name}"`);
  assert.ok(step.script, `"${name}" in ${WORKERS} has no script`);
  return step;
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
    const { start, script: commands } = stepNamed(lines, DOWNLOAD_STEP);
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

  void it('start every inline init script by stopping on its first failed command', () => {
    const steps = initSteps(executableLines(read(WORKERS))).filter(
      (step) => step.script
    );
    assert.ok(
      steps.some((step) => step.name === DOWNLOAD_STEP),
      `${WORKERS} has no inline step "${DOWNLOAD_STEP}"`
    );
    for (const { name, script } of steps) {
      assert.ok(name, `${WORKERS} has an inline init step without a name`);
      assert.equal(
        script[0],
        FAIL_FAST,
        `"${name}" in ${WORKERS} must start its script with "${FAIL_FAST}"`
      );
    }
  });

  void it('download the emulators only in the download step', () => {
    const lines = executableLines(read(WORKERS));
    const { script: commands } = stepNamed(lines, DOWNLOAD_STEP);
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
