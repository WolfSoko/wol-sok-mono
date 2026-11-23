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
//
// The Android app (#3206) has no Nx dependencies, so a file outside its folder
// that its deploy script reads counts only when its deploy names it.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { posix } from 'node:path';
import { describe, it } from 'node:test';
import { ROOT, readProjects, stringInputs } from './workspace-projects.mjs';

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
// They hold specs and test configs; `production` builds on the stack's own.
const TEST_INCLUDING_INPUTS = ['default', '^default'];
const ANDROID_APP = 'bacteria-wars-android';
const TSX_SCRIPT = /(?:^|\s)(?:\.\/)?(tools\/\S+\.ts)(?:\s|$)/;
const RELATIVE_IMPORT = /\bfrom\s+'(\.{1,2}\/[^']+)'/g;
// A workspace file a module names literally, as `resolve('libs/…/x.json')`.
const WORKSPACE_PATH = /'((?:apps|libs|tools)\/[^'\s]+\.\w+)'/g;

const PROJECTS = readProjects();

/** A relative import's module, as tsx resolves it (`./x` is `./x.ts`). */
function moduleFile(from, specifier) {
  const path = posix.join(posix.dirname(from), specifier);
  return [path, `${path}.ts`, `${path}/index.ts`].find(
    (candidate) =>
      existsSync(`${ROOT}/${candidate}`) && candidate.endsWith('.ts')
  );
}

/**
 * The script a deploy command runs, the modules it imports relatively,
 * transitively, and the workspace files those modules name literally.
 */
function filesReadBy(script) {
  const modules = new Set();
  const paths = new Set();
  const queue = [script];
  while (queue.length > 0) {
    const file = queue.shift();
    if (modules.has(file)) continue;
    modules.add(file);
    const source = readFileSync(`${ROOT}/${file}`, 'utf8');
    for (const [, specifier] of source.matchAll(RELATIVE_IMPORT)) {
      const imported = moduleFile(file, specifier);
      assert.ok(imported, `${file}: cannot resolve ${specifier}`);
      queue.push(imported);
    }
    for (const [, path] of source.matchAll(WORKSPACE_PATH)) paths.add(path);
  }
  return [...modules, ...paths];
}

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
      .filter(
        ({ deploy }) =>
          !Array.isArray(deploy.inputs) || deploy.inputs.length === 0
      )
      .map(({ project }) => project.path);
    assert.deepEqual(undeclared, []);
  });

  void it('leave out tests in every CDK stack deploy', () => {
    const stacks = deployTargets().filter(
      ({ deploy }) => deploy.executor === CDK_DEPLOY_EXECUTOR
    );
    assert.ok(stacks.length > 0, `no ${CDK_DEPLOY_EXECUTOR} target found`);
    const wrong = stacks.flatMap(({ project, deploy }) => {
      const inputs = stringInputs(deploy.inputs);
      return [
        ...CDK_DEPLOY_INPUTS.filter((input) => !inputs.includes(input)).map(
          (input) => `${project.path} deploy: missing ${input}`
        ),
        ...TEST_INCLUDING_INPUTS.filter((input) => inputs.includes(input)).map(
          (input) => `${project.path} deploy: drop ${input}`
        ),
      ];
    });
    assert.deepEqual(wrong, []);
  });

  void it('name every file outside the Android app its deploy reads', () => {
    const android = PROJECTS.find(
      (project) => project.json.name === ANDROID_APP
    );
    assert.ok(android, `no ${ANDROID_APP} project found`);
    const deploy = android.json.targets.deploy;
    const [script] = commandsOf(deploy)
      .map((command) => command.match(TSX_SCRIPT)?.[1])
      .filter(Boolean);
    assert.ok(script, `${android.path} deploy runs no tools script`);
    const appRoot = `${posix.dirname(android.path)}/`;
    const inputs = stringInputs(deploy.inputs);
    const missing = filesReadBy(script)
      .filter((file) => !file.startsWith(appRoot))
      .map((file) => `{workspaceRoot}/${file}`)
      .filter((input) => !inputs.includes(input));
    assert.deepEqual(missing, []);
  });
});
