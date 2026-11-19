// The workspace's project.json files and target inputs, as the tools/ci
// tests read them.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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
