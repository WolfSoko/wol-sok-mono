// The workspace's project.json files and target inputs, as the tools/ci
// tests read them.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const ROOT = join(import.meta.dirname, '..', '..');

export function readJson(path) {
  return JSON.parse(readFileSync(join(ROOT, path), 'utf8'));
}

/** Every tracked `project.json` as `{ path, json }`. */
export function readProjects() {
  return execFileSync('git', ['ls-files', 'project.json', '**/project.json'], {
    cwd: ROOT,
    encoding: 'utf8',
  })
    .split('\n')
    .filter((path) => path !== '')
    .map((path) => ({ path, json: readJson(path) }));
}

/** The plain string inputs of an inputs list (leaves out object inputs). */
export function stringInputs(inputs) {
  return (inputs ?? []).filter((input) => typeof input === 'string');
}
