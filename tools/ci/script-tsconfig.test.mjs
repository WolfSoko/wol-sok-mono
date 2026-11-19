// Every script oxlint lints belongs to the program of its nearest
// tsconfig.json (#3074, #3133). Type-aware oxlint types a file in that
// program; a file it leaves out lands in a fallback program built from
// whatever other unowned files the same run lints, so its type-aware findings
// changed between `nx lint <project>`, a batched lint run and `npx oxlint .`.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, matchesGlob, relative, resolve } from 'node:path';
import { describe, it } from 'node:test';
import ts from 'typescript';
import {
  CI_WORKFLOW,
  ROOT,
  SKIPPING_KEYS,
  gitLsFiles,
  readJson,
  stepBlock,
} from './workspace-projects.mjs';

const SCRIPT_FILE = /\.[cm]?[jt]sx?$/;
const DECLARATION_FILE = /\.d\.[cm]?ts$/;
const TSCONFIG = 'tsconfig.json';
// A new file makes only its own project affected, never `tools`, so CI runs
// this guard on every run as a step of its own, outside Nx.
const GUARD_STEP_NAME = '- name: Scripts belong to their tsconfig';
const GUARD_COMMAND = 'run: node --test tools/ci/script-tsconfig.test.mjs';

/** The tracked scripts oxlint lints: none its `ignorePatterns` match. */
function lintedScripts() {
  const { ignorePatterns } = readJson('.oxlintrc.json');
  return gitLsFiles().filter(
    (path) =>
      SCRIPT_FILE.test(path) &&
      !DECLARATION_FILE.test(path) &&
      !ignorePatterns.some((pattern) => matchesGlob(path, pattern))
  );
}

/** The `tsconfig.json` closest above `path`, relative to the root, or null. */
function nearestTsconfig(path) {
  for (let dir = dirname(path); ; dir = dirname(dir)) {
    const candidate = join(dir, TSCONFIG);
    if (existsSync(join(ROOT, candidate))) return candidate;
    if (dir === '.') return null;
  }
}

function parseTsconfig(absolutePath) {
  return ts.getParsedCommandLineOfConfigFile(
    absolutePath,
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
}

/**
 * The files of a tsconfig's program and of every project it references,
 * transitively, relative to the root. A reference to a missing config owns
 * nothing, as for TypeScript and tsgolint.
 */
function ownedFiles(tsconfigPath, seen = new Set()) {
  const absolutePath = resolve(ROOT, tsconfigPath);
  if (seen.has(absolutePath) || !existsSync(absolutePath)) return [];
  seen.add(absolutePath);
  const parsed = parseTsconfig(absolutePath);
  const referenced = (parsed.projectReferences ?? []).flatMap((reference) =>
    ownedFiles(ts.resolveProjectReferencePath(reference), seen)
  );
  return [
    ...parsed.fileNames.map((file) => relative(ROOT, file)),
    ...referenced,
  ];
}

/** The scripts their nearest tsconfig.json does not own, by that config. */
function unownedScripts() {
  const owned = new Map();
  const unowned = {};
  for (const path of lintedScripts()) {
    const tsconfig = nearestTsconfig(path) ?? `(no ${TSCONFIG})`;
    if (!owned.has(tsconfig)) {
      owned.set(
        tsconfig,
        new Set(tsconfig.startsWith('(') ? [] : ownedFiles(tsconfig))
      );
    }
    if (!owned.get(tsconfig).has(path)) (unowned[tsconfig] ??= []).push(path);
  }
  return unowned;
}

void describe('the linted scripts', () => {
  void it('each belong to the program of their nearest tsconfig.json, so type-aware lint types them the same on every run', () => {
    assert.deepEqual(
      unownedScripts(),
      {},
      'widen the "include" of the named tsconfig.json or of a config it references'
    );
  });
});

void describe('the CI workflow', () => {
  void it('runs this guard on every run, outside the affected tasks', () => {
    const step = stepBlock(
      readFileSync(join(ROOT, CI_WORKFLOW), 'utf8'),
      GUARD_STEP_NAME
    );
    assert.ok(step, `${CI_WORKFLOW} has no step "${GUARD_STEP_NAME}"`);
    assert.ok(step.includes(GUARD_COMMAND), step);
    assert.doesNotMatch(step, SKIPPING_KEYS);
  });
});
