import * as childProcess from 'child_process';
import { logger } from '@nx/devkit';

import executor from './synth';
import { SynthExecutorSchema } from './schema';
import { generateCommandString, LARGE_BUFFER } from '../../utils/executor.util';
import {
  mockExecutorContext,
  runExecutorToExit,
  spawnFakeChildProcess,
} from '../../utils/testing';

jest.mock('child_process', () => ({
  ...jest.requireActual('child_process'),
  exec: jest.fn(),
}));

const options: SynthExecutorSchema = {};

const nodeCommandWithRelativePath = generateCommandString('synth', 'apps/proj');

describe('aws-cdk-v2 synth Executor', () => {
  const context = mockExecutorContext('synth');
  const execMock = jest.mocked(childProcess.exec);

  beforeEach(() => {
    jest.spyOn(logger, 'debug');
    execMock.mockImplementation(spawnFakeChildProcess);
  });

  afterEach(() => jest.clearAllMocks());

  it('run cdk synth command', async () => {
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

  it('run cdk synth command stack', async () => {
    const option: SynthExecutorSchema = Object.assign({}, options);
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

  it('run cdk synth command context options', async () => {
    const option: SynthExecutorSchema = Object.assign({}, options);
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

  it('run cdk synth command with multiple context options', async () => {
    const option: SynthExecutorSchema = Object.assign({}, options);
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

  it('run cdk synth command with boolean context option', async () => {
    const option: SynthExecutorSchema & { exclusively: boolean } = {
      ...options,
      exclusively: true,
    };
    await runExecutorToExit(execMock, () => executor(option, context));
    expect(childProcess.exec).toHaveBeenCalledWith(
      `${nodeCommandWithRelativePath} --exclusively true`,
      expect.objectContaining({
        env: process.env,
        maxBuffer: LARGE_BUFFER,
      })
    );

    expect(logger.debug).toHaveBeenLastCalledWith(
      `Executing command: ${nodeCommandWithRelativePath} --exclusively true`
    );
  });
});
