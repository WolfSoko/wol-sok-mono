import * as childProcess from 'child_process';
import { logger } from '@nx/devkit';

import executor from './deploy';
import { DeployExecutorSchema } from './schema';
import { generateCommandString } from '../../utils/executor.util';
import {
  expectedSpawnOptions,
  mockExecutorContext,
  runExecutorToExit,
  spawnFakeChildProcess,
} from '../../testing/executor';

jest.mock('child_process', () => ({
  ...jest.requireActual('child_process'),
  spawn: jest.fn(),
}));

const options: DeployExecutorSchema = {};

const nodeCommandWithRelativePath = generateCommandString(
  'deploy',
  'apps/proj'
);

describe('aws-cdk-v2 deploy Executor', () => {
  const context = mockExecutorContext('deploy');
  const spawnMock = jest.mocked(childProcess.spawn);

  beforeEach(() => {
    jest.spyOn(logger, 'debug');
    spawnMock.mockImplementation(spawnFakeChildProcess);
  });

  afterEach(() => jest.clearAllMocks());

  it('run cdk deploy command', async () => {
    await runExecutorToExit(spawnMock, () => executor(options, context));
    expect(childProcess.spawn).toHaveBeenCalledWith(
      nodeCommandWithRelativePath,
      expectedSpawnOptions(context.root)
    );
    expect(logger.debug).toHaveBeenLastCalledWith(
      `Executing command: ${nodeCommandWithRelativePath}`
    );
  });

  it('reports failure when the cdk process exits with a non-zero code', async () => {
    const result = await runExecutorToExit(
      spawnMock,
      () => executor(options, context),
      1
    );
    expect(spawnMock).toHaveBeenCalledWith(
      nodeCommandWithRelativePath,
      expect.anything()
    );
    expect(result).toEqual({ success: false });
  });

  it('run cdk deploy command stack', async () => {
    const option: DeployExecutorSchema = Object.assign({}, options);
    const stackName = 'test';
    option['stacks'] = stackName;
    await runExecutorToExit(spawnMock, () => executor(option, context));
    expect(childProcess.spawn).toHaveBeenCalledWith(
      `${nodeCommandWithRelativePath} ${stackName}`,
      expectedSpawnOptions(context.root)
    );

    expect(logger.debug).toHaveBeenLastCalledWith(
      `Executing command: ${nodeCommandWithRelativePath} ${stackName}`
    );
  });

  it('run cdk deploy command context options', async () => {
    const option: DeployExecutorSchema = Object.assign({}, options);
    const contextOptionString = 'key=value';
    option['context'] = contextOptionString;
    await runExecutorToExit(spawnMock, () => executor(option, context));
    expect(childProcess.spawn).toHaveBeenCalledWith(
      `${nodeCommandWithRelativePath} --context ${contextOptionString}`,
      expectedSpawnOptions(context.root)
    );

    expect(logger.debug).toHaveBeenLastCalledWith(
      `Executing command: ${nodeCommandWithRelativePath} --context ${contextOptionString}`
    );
  });

  it('run cdk deploy command with multiple context options', async () => {
    const option: DeployExecutorSchema = Object.assign({}, options);
    const contextOptions = ['firstKey=firstValue', 'secondKey=secondValue'];
    option['context'] = contextOptions;
    await runExecutorToExit(spawnMock, () => executor(option, context));
    const contextCmd = contextOptions
      .map((option) => `--context ${option}`)
      .join(' ');
    expect(childProcess.spawn).toHaveBeenCalledWith(
      `${nodeCommandWithRelativePath} ${contextCmd}`,
      expectedSpawnOptions(context.root)
    );

    expect(logger.debug).toHaveBeenLastCalledWith(
      `Executing command: ${nodeCommandWithRelativePath} ${contextCmd}`
    );
  });

  it('forwards options that are not part of the schema to the cdk cli', async () => {
    const option: DeployExecutorSchema & { hotswap: boolean } = {
      ...options,
      hotswap: true,
    };
    await runExecutorToExit(spawnMock, () => executor(option, context));
    expect(childProcess.spawn).toHaveBeenCalledWith(
      `${nodeCommandWithRelativePath} --hotswap true`,
      expectedSpawnOptions(context.root)
    );

    expect(logger.debug).toHaveBeenLastCalledWith(
      `Executing command: ${nodeCommandWithRelativePath} --hotswap true`
    );
  });
});
