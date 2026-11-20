// The workspace's project.json files and target inputs, as the tools/ci
// tests read them.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, matchesGlob } from 'node:path';

export const ROOT = join(import.meta.dirname, '..', '..');

export function readJson(path) {
  return JSON.parse(readFileSync(join(ROOT, path), 'utf8'));
}

/** The tracked files matching the git pathspecs, relative to the root. */
export function gitLsFiles(...pathspecs) {
  return execFileSync('git', ['ls-files', '--', ...pathspecs], {
    cwd: ROOT,
    encoding: 'utf8',
  })
    .split('\n')
    .filter((path) => path !== '');
}

/** Every tracked `project.json` as `{ path, json }`. */
export function readProjects() {
  return gitLsFiles('project.json', '**/project.json').map((path) => ({
    path,
    json: readJson(path),
  }));
}

/** The plain string inputs of an inputs list (leaves out object inputs). */
export function stringInputs(inputs) {
  return (inputs ?? []).filter((input) => typeof input === 'string');
}

/** The workflow that runs the checks of every push and pull request. */
export const CI_WORKFLOW = '.github/workflows/ci-cd.yml';
/** Keys that would let a step be skipped or fail without failing the run. */
export const SKIPPING_KEYS = /^\s+(if|continue-on-error):/m;

/** The lines of the step named `name`, up to the next step or job. */
export function stepBlock(workflow, name) {
  const lines = workflow.split('\n');
  const start = lines.findIndex((line) => line.trim() === name);
  if (start === -1) return null;
  const indent = lines[start].indexOf('-');
  const end = lines.findIndex(
    (line, i) => i > start && line.trim() !== '' && line.search(/\S/) <= indent
  );
  return lines.slice(start, end === -1 ? undefined : end).join('\n');
}

/**
 * Asserts that the CI workflow runs a guard as the step `name` with the
 * command `command` on every run: a step outside Nx, with no `if:` or
 * `continue-on-error`. A guard needs one where the files it checks make
 * only their own project affected, never `tools`.
 */
export function assertRunsOnEveryCiRun(name, command) {
  const step = stepBlock(readFileSync(join(ROOT, CI_WORKFLOW), 'utf8'), name);
  assert.ok(step, `${CI_WORKFLOW} has no step "${name}"`);
  assert.ok(step.includes(command), step);
  assert.doesNotMatch(step, SKIPPING_KEYS);
}

const SCRIPT_FILE = /\.[cm]?[jt]sx?$/;
const DECLARATION_FILE = /\.d\.[cm]?ts$/;
export const TSCONFIG = 'tsconfig.json';

/** The tracked scripts oxlint lints: none its `ignorePatterns` match. */
export function lintedScripts() {
  const { ignorePatterns } = readJson('.oxlintrc.json');
  return gitLsFiles().filter(
    (path) =>
      SCRIPT_FILE.test(path) &&
      !DECLARATION_FILE.test(path) &&
      !ignorePatterns.some((pattern) => matchesGlob(path, pattern))
  );
}

/** The `tsconfig.json` closest above `path`, relative to the root, or null. */
export function nearestTsconfig(path) {
  for (let dir = dirname(path); ; dir = dirname(dir)) {
    const candidate = join(dir, TSCONFIG);
    if (existsSync(join(ROOT, candidate))) return candidate;
    if (dir === '.') return null;
  }
}

/**
 * The paths that belong to the root project: Nx gives a file to the project
 * with the longest root containing it, and to the root project only when no
 * other project's root does.
 */
export function rootProjectFiles(paths) {
  const roots = readProjects()
    .map((project) => dirname(project.path))
    .filter((root) => root !== '.');
  return paths.filter(
    (path) => !roots.some((root) => path.startsWith(`${root}/`))
  );
}
