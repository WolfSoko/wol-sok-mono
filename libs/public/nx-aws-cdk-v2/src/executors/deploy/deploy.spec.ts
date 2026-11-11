import * as childProcess from 'child_process';
import { logger } from '@nx/devkit';

import executor from './deploy';
import { DeployExecutorSchema } from './schema';
import { generateCommandString, LARGE_BUFFER } from '../../utils/executor.util';
import {
  mockExecutorContext,
  runExecutorToExit,
  spawnFakeChildProcess,
} from '../../testing/executor';

jest.mock('child_process', () => ({
  ...jest.requireActual('child_process'),
  exec: jest.fn(),
}));

const options: DeployExecutorSchema = {};

const nodeCommandWithRelativePath = generateCommandString(
  'deploy',
  'apps/proj'
);

describe('aws-cdk-v2 deploy Executor', () => {
  const context = mockExecutorContext('deploy');
  const execMock = jest.mocked(childProcess.exec);

  beforeEach(() => {
    jest.spyOn(logger, 'debug');
    execMock.mockImplementation(spawnFakeChildProcess);
  });

  afterEach(() => jest.clearAllMocks());

  it('run cdk deploy command', async () => {
    await runExecutorToExit(execMock, () => executor(options, context));
    expect(childProcess.exec).toHaveBeenCalledWith(
      nodeCommandWithRelativePath,
      expect.objectContaining({
        cwd: context.root,
        env: process.env,
        maxBuffer: LARGE_BUFFER,
      })
    );
    expect(logger.debug).toHaveBeenLastCalledWith(
      `Executing command: ${nodeCommandWithRelativePath}`
    );
  });

  it('reports failure when the cdk process exits with a non-zero code', async () => {
    const result = await runExecutorToExit(
      execMock,
      () => executor(options, context),
      1
    );
    expect(execMock).toHaveBeenCalledWith(
      nodeCommandWithRelativePath,
      expect.anything()
    );
    expect(result).toEqual({ success: false });
  });

  it('run cdk deploy command stack', async () => {
    const option: DeployExecutorSchema = Object.assign({}, options);
    const stackName = 'test';
    option['stacks'] = stackName;
    await runExecutorToExit(execMock, () => executor(option, context));
    expect(childProcess.exec).toHaveBeenCalledWith(
      `${nodeCommandWithRelativePath} ${stackName}`,
      expect.objectContaining({
        env: process.env,
        maxBuffer: LARGE_BUFFER,
      })
    );

    expect(logger.debug).toHaveBeenLastCalledWith(
      `Executing command: ${nodeCommandWithRelativePath} ${stackName}`
    );
  });

  it('run cdk deploy command context options', async () => {
    const option: DeployExecutorSchema = Object.assign({}, options);
    const contextOptionString = 'key=value';
    option['context'] = contextOptionString;
    await runExecutorToExit(execMock, () => executor(option, context));
    expect(childProcess.exec).toHaveBeenCalledWith(
      `${nodeCommandWithRelativePath} --context ${contextOptionString}`,
      expect.objectContaining({
        env: process.env,
        maxBuffer: LARGE_BUFFER,
      })
    );

    expect(logger.debug).toHaveBeenLastCalledWith(
      `Executing command: ${nodeCommandWithRelativePath} --context ${contextOptionString}`
    );
  });

  it('run cdk deploy command with multiple context options', async () => {
    const option: DeployExecutorSchema = Object.assign({}, options);
    const contextOptions = ['firstKey=firstValue', 'secondKey=secondValue'];
    option['context'] = contextOptions;
    await runExecutorToExit(execMock, () => executor(option, context));
    const contextCmd = contextOptions
      .map((option) => `--context ${option}`)
      .join(' ');
    expect(childProcess.exec).toHaveBeenCalledWith(
      `${nodeCommandWithRelativePath} ${contextCmd}`,
      expect.objectContaining({
        env: process.env,
        maxBuffer: LARGE_BUFFER,
      })
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
    await runExecutorToExit(execMock, () => executor(option, context));
    expect(childProcess.exec).toHaveBeenCalledWith(
      `${nodeCommandWithRelativePath} --hotswap true`,
      expect.objectContaining({
        env: process.env,
        maxBuffer: LARGE_BUFFER,
      })
    );

    expect(logger.debug).toHaveBeenLastCalledWith(
      `Executing command: ${nodeCommandWithRelativePath} --hotswap true`
    );
  });
});
