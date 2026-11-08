import * as path from 'path';
import {
  addProjectConfiguration,
  convertNxGenerator,
  formatFiles,
  generateFiles,
  GeneratorCallback,
  getWorkspaceLayout,
  names,
  offsetFromRoot,
  ProjectConfiguration,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
  updateJson,
  updateProjectConfiguration,
} from '@nx/devkit';
import { configurationGenerator } from '@nx/jest';

import { ApplicationSchema } from './schema';
import { initGenerator } from '../init/init';

interface NormalizedSchema extends ApplicationSchema {
  projectName: string;
  projectRoot: string;
  projectDirectory: string;
  parsedTags: string[];
  /** Root tsconfig the app's tsconfig.json extends. */
  baseTsconfig: string;
}

/** Root tsconfig a workspace keeps for Node-only CDK apps (e.g. an ESNext target). */
const CDK_TSCONFIG = 'tsconfig.cdk.json';
const BASE_TSCONFIG = 'tsconfig.base.json';

/** The root tsconfig the app's tsconfig.json extends: the CDK one where the workspace has it. */
function baseTsconfig(host: Tree): string {
  return host.exists(CDK_TSCONFIG) ? CDK_TSCONFIG : BASE_TSCONFIG;
}

/**
 * In a TS-solution workspace `@nx/jest` writes a `tsconfig.spec.json` that extends
 * `<offset>tsconfig.base.json` directly. Point it at the root tsconfig the app itself
 * extends, so the specs compile with the same options as the app. Any other `extends`
 * (`./tsconfig.json` outside a TS-solution workspace) is left as it is.
 */
function pointSpecTsconfigAtAppBase(
  host: Tree,
  options: NormalizedSchema
): void {
  const specTsconfig = `${options.projectRoot}/tsconfig.spec.json`;
  if (options.baseTsconfig === BASE_TSCONFIG || !host.exists(specTsconfig)) {
    return;
  }
  const offset = offsetFromRoot(options.projectRoot);
  updateJson(host, specTsconfig, (json) => {
    if (json.extends === `${offset}${BASE_TSCONFIG}`) {
      json.extends = `${offset}${options.baseTsconfig}`;
    }
    return json;
  });
}

function normalizeOptions(
  host: Tree,
  options: ApplicationSchema
): NormalizedSchema {
  const name = names(options.name).fileName;
  const projectDirectory = options.directory
    ? `${names(options.directory).fileName}/${name}`
    : name;
  const projectName = projectDirectory.replace(new RegExp('/', 'g'), '-');
  const projectRoot = `${getWorkspaceLayout(host).appsDir}/${projectDirectory}`;
  const parsedTags = options.tags
    ? options.tags.split(',').map((s) => s.trim())
    : [];

  return {
    ...options,
    projectName,
    projectRoot,
    projectDirectory,
    parsedTags,
    baseTsconfig: baseTsconfig(host),
    unitTestRunner: options.unitTestRunner ?? 'jest',
  };
}

function templateOptions(options: NormalizedSchema) {
  return {
    ...options,
    ...names(options.projectName),
    offsetFromRoot: offsetFromRoot(options.projectRoot),
    template: '',
  };
}

function addFiles(host: Tree, options: NormalizedSchema, folder: string) {
  generateFiles(
    host,
    path.join(__dirname, folder),
    options.projectRoot,
    templateOptions(options)
  );
}

/** The names the starter test carries. */
export interface StarterTestNames {
  /** The name of the test's describe block. */
  readonly describeName: string;
  /** The stack id the test passes to `AppStack`, without its `TestStack` suffix. */
  readonly stackPrefix: string;
}

/**
 * Writes the starter `src/main.test.ts` into a project, replacing one that is
 * there. The `update-starter-test` migration writes it the same way.
 */
export function writeStarterTest(
  host: Tree,
  projectRoot: string,
  starter: StarterTestNames
): void {
  generateFiles(host, path.join(__dirname, 'jest-files'), projectRoot, {
    className: starter.describeName,
    projectName: starter.stackPrefix,
    template: '',
  });
}

export async function applicationGenerator(
  host: Tree,
  options: ApplicationSchema
) {
  const tasks: GeneratorCallback[] = [];
  const normalizedOptions = normalizeOptions(host, options);
  const initTask = await initGenerator(host, {
    ...options,
    skipFormat: true,
  });

  tasks.push(initTask);

  const project: ProjectConfiguration = {
    root: normalizedOptions.projectRoot,
    projectType: 'application',
    sourceRoot: `${normalizedOptions.projectRoot}/src`,
    targets: {
      deploy: {
        executor: '@wolsok/nx-aws-cdk-v2:deploy',
        options: {},
      },
      synth: {
        executor: '@wolsok/nx-aws-cdk-v2:synth',
        options: {},
      },
      destroy: {
        executor: '@wolsok/nx-aws-cdk-v2:destroy',
        options: {},
      },
      bootstrap: {
        executor: '@wolsok/nx-aws-cdk-v2:bootstrap',
        options: {},
      },
    },
    tags: normalizedOptions.parsedTags,
  };
  addProjectConfiguration(host, normalizedOptions.projectName, project);
  const workspace = readProjectConfiguration(
    host,
    normalizedOptions.projectName
  );

  updateProjectConfiguration(host, normalizedOptions.projectName, workspace);
  addFiles(host, normalizedOptions, 'files');

  if (normalizedOptions.unitTestRunner === 'jest') {
    // `configurationGenerator` forwards its whole options object to `@nx/js`'s init
    // generator, where `skipFormat` only guards the formatFiles call - `ensurePackage`
    // for prettier still runs unless `formatter: 'none'` is set too. Since we already
    // skip formatting here, also skip ensuring prettier: requiring the real prettier
    // package from inside Jest's own module sandbox (i.e. when this generator runs in
    // a unit test) crashes with "dynamic import callback ... without --experimental-vm-modules".
    // `formatter` isn't part of JestProjectSchema's public type, so build the options
    // object separately to avoid TypeScript's excess-property check on the call site.
    const jestConfigOptions = {
      project: normalizedOptions.projectName,
      setupFile: 'none',
      skipSerializers: true,
      supportTsx: false,
      babelJest: false,
      testEnvironment: 'node',
      skipFormat: true,
      formatter: 'none',
    } as const;
    const jestTask = await configurationGenerator(host, jestConfigOptions);
    tasks.push(jestTask);
    pointSpecTsconfigAtAppBase(host, normalizedOptions);
    writeStarterTest(host, normalizedOptions.projectRoot, {
      describeName: names(normalizedOptions.projectName).className,
      stackPrefix: normalizedOptions.projectName,
    });
  }

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return runTasksInSerial(...tasks);
}

export default applicationGenerator;
export const applicationSchematic = convertNxGenerator(applicationGenerator);
