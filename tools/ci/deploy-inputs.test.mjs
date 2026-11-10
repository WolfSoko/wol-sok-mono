// Keeps each app's root Firebase config among its deploy inputs (#2904), so a
// change to the config makes the app affected and the next release redeploys
// it. Nx interpolates `{projectName}` in commands, not in inputs: such an input
// matches no file at all, and nothing reports it.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const ROOT = join(import.meta.dirname, '..', '..');
const PROJECT_NAME = '{projectName}';
// A root config only: one under apps/ (emulators) is a file of its project.
const ROOT_FIREBASE_CONFIG =
  /(?:--config[=\s]+|-c\s+)(?:\.\/)?(firebase\.[^\s/"']+\.json)/g;

function readProjects() {
  return execFileSync('git', ['ls-files', 'project.json', '**/project.json'], {
    cwd: ROOT,
    encoding: 'utf8',
  })
    .split('\n')
    .filter((path) => path !== '')
    .map((path) => ({
      path,
      json: JSON.parse(readFileSync(join(ROOT, path), 'utf8')),
    }));
}

function targetsOf(project) {
  return Object.entries(project.json.targets ?? {});
}

function stringInputs(target) {
  return (target.inputs ?? []).filter((input) => typeof input === 'string');
}

function commandsOf(target) {
  return [
    target,
    target.options ?? {},
    ...Object.values(target.configurations ?? {}),
  ]
    .flatMap((source) => [source.command, ...(source.commands ?? [])])
    .map((command) =>
      typeof command === 'object' ? command?.command : command
    )
    .filter((command) => typeof command === 'string');
}

function rootFirebaseConfigsOf(project) {
  const name = project.json.name;
  assert.ok(name, `${project.path} has no name to resolve ${PROJECT_NAME}`);
  const configs = targetsOf(project)
    .flatMap(([, target]) => commandsOf(target))
    .flatMap((command) => [...command.matchAll(ROOT_FIREBASE_CONFIG)])
    .map(([, file]) => file.replaceAll(PROJECT_NAME, name));
  return [...new Set(configs)];
}

const PROJECTS = readProjects();

describe('target inputs', () => {
  it('never use {projectName}, which Nx leaves unresolved in inputs', () => {
    const unresolved = PROJECTS.flatMap((project) =>
      targetsOf(project).flatMap(([targetName, target]) =>
        stringInputs(target)
          .filter((input) => input.includes(PROJECT_NAME))
          .map((input) => `${project.path} ${targetName}: ${input}`)
      )
    );
    assert.deepEqual(unresolved, []);
  });
});

describe('deploy inputs', () => {
  it('name every root Firebase config the project passes to the CLI', () => {
    const missing = PROJECTS.flatMap((project) => {
      const deploy = project.json.targets?.deploy;
      if (!deploy) return [];
      const inputs = stringInputs(deploy);
      return rootFirebaseConfigsOf(project)
        .map((file) => `{workspaceRoot}/${file}`)
        .filter((input) => !inputs.includes(input))
        .map((input) => `${project.path} deploy: ${input}`);
    });
    assert.deepEqual(missing, []);
  });

  it('cover the apps that deploy through a root Firebase config', () => {
    const checked = PROJECTS.filter((project) => project.json.targets?.deploy)
      .filter((project) => rootFirebaseConfigsOf(project).length > 0)
      .map((project) => project.json.name)
      .sort();
    assert.deepEqual(checked, [
      'bacteria-game-remote',
      'bacteria-wars-functions',
      'korbjaeger',
      'korbjaeger-functions',
      'pacetrainer',
      'rollapolla-analog',
    ]);
  });
});
