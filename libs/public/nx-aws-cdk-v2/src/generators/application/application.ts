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
    unitTestRunner: options.unitTestRunner ?? 'jest',
  };
}

/** Root tsconfig a workspace keeps for Node-only CDK apps (e.g. an ESNext target). */
const CDK_TSCONFIG = 'tsconfig.cdk.json';
const BASE_TSCONFIG = 'tsconfig.base.json';

/** The root tsconfig the app's tsconfig.json extends: the CDK one where the workspace has it. */
function baseTsconfig(host: Tree): string {
  return host.exists(CDK_TSCONFIG) ? CDK_TSCONFIG : BASE_TSCONFIG;
}

function templateOptions(host: Tree, options: NormalizedSchema) {
  return {
    ...options,
    ...names(options.projectName),
    offsetFromRoot: offsetFromRoot(options.projectRoot),
    baseTsconfig: baseTsconfig(host),
    template: '',
  };
}

function addFiles(host: Tree, options: NormalizedSchema, folder: string) {
  generateFiles(
    host,
    path.join(__dirname, folder),
    options.projectRoot,
    templateOptions(host, options)
  );
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
    addFiles(host, normalizedOptions, 'jest-files');
  }

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return runTasksInSerial(...tasks);
}

export default applicationGenerator;
export const applicationSchematic = convertNxGenerator(applicationGenerator);
