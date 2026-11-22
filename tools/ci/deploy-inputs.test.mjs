// Keeps each app's root Firebase config among its deploy inputs (#2904), so a
// change to the config makes the app affected and the next release redeploys
// it. Nx interpolates `{projectName}` in commands, not in inputs: such an input
// matches no file at all, and nothing reports it (checked for every target in
// target-inputs.test.mjs).
//
// Every deploy target names its inputs (#3142): without them Nx takes
// `default` and `^default`, so specs and test configs of the project and of
// every project below it count, and release-affected.mjs redeploys it for a
// test-only change.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readProjects, stringInputs } from './workspace-projects.mjs';

const PROJECT_NAME = '{projectName}';
// A root config only: one under apps/ (emulators) is a file of its project.
const ROOT_FIREBASE_CONFIG =
  /(?:--config[=\s]+|-c\s+)(?:\.\/)?(firebase\.[^\s/"']+\.json)/g;

function targetsOf(project) {
  return Object.entries(project.json.targets ?? {});
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

const CDK_DEPLOY_EXECUTOR = '@wolsok/nx-aws-cdk-v2:deploy';
const CDK_DEPLOY_INPUTS = ['production', '^production'];
// A Gradle project without Nx dependencies: its implicit `default` is already
// exactly its folder, and an edit of its project.json alone would upload an
// unchanged app to Play.
const IMPLICIT_DEPLOY_INPUTS = new Set(['bacteria-wars-android']);

const PROJECTS = readProjects();

function deployTargets() {
  return PROJECTS.filter((project) => project.json.targets?.deploy).map(
    (project) => ({ project, deploy: project.json.targets.deploy })
  );
}

void describe('deploy inputs', () => {
  void it('name every root Firebase config the project passes to the CLI', () => {
    const missing = PROJECTS.flatMap((project) => {
      const deploy = project.json.targets?.deploy;
      if (!deploy) return [];
      const inputs = stringInputs(deploy.inputs);
      return rootFirebaseConfigsOf(project)
        .map((file) => `{workspaceRoot}/${file}`)
        .filter((input) => !inputs.includes(input))
        .map((input) => `${project.path} deploy: ${input}`);
    });
    assert.deepEqual(missing, []);
  });

  void it('cover the apps that deploy through a root Firebase config', () => {
    const checked = PROJECTS.filter((project) => project.json.targets?.deploy)
      .filter((project) => rootFirebaseConfigsOf(project).length > 0)
      .map((project) => project.json.name)
      .sort((a, b) => a.localeCompare(b));
    assert.deepEqual(checked, [
      'bacteria-game-remote',
      'bacteria-wars-functions',
      'pacetrainer',
      'rollapolla-analog',
    ]);
  });

  void it('are declared by every deploy target', () => {
    const undeclared = deployTargets()
      .filter(({ project }) => !IMPLICIT_DEPLOY_INPUTS.has(project.json.name))
      .filter(({ deploy }) => !Array.isArray(deploy.inputs))
      .map(({ project }) => project.path);
    assert.deepEqual(undeclared, []);
  });

  void it('leave out tests in every CDK stack deploy', () => {
    const stacks = deployTargets().filter(
      ({ deploy }) => deploy.executor === CDK_DEPLOY_EXECUTOR
    );
    assert.ok(stacks.length > 0, `no ${CDK_DEPLOY_EXECUTOR} target found`);
    const missing = stacks.flatMap(({ project, deploy }) =>
      CDK_DEPLOY_INPUTS.filter(
        (input) => !stringInputs(deploy.inputs).includes(input)
      ).map((input) => `${project.path} deploy: ${input}`)
    );
    assert.deepEqual(missing, []);
  });

  void it('exempt only deploy targets that exist', () => {
    const names = new Set(
      deployTargets().map(({ project }) => project.json.name)
    );
    assert.deepEqual(
      [...IMPLICIT_DEPLOY_INPUTS].filter((name) => !names.has(name)),
      []
    );
  });
});
