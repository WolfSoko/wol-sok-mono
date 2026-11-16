import * as childProcess from 'child_process';
import { logger } from '@nx/devkit';

import executor from './synth';
import { SynthExecutorSchema } from './schema';
import { generateCommandString } from '../../utils/executor.util';
import {
  mockExecutorContext,
  runExecutorToExit,
  spawnFakeChildProcess,
} from '../../testing/executor';

jest.mock('child_process', () => ({
  ...jest.requireActual('child_process'),
  spawn: jest.fn(),
}));

const options: SynthExecutorSchema = {};

const nodeCommandWithRelativePath = generateCommandString('synth', 'apps/proj');

describe('aws-cdk-v2 synth Executor', () => {
  const context = mockExecutorContext('synth');
  const spawnMock = jest.mocked(childProcess.spawn);

  beforeEach(() => {
    jest.spyOn(logger, 'debug');
    spawnMock.mockImplementation(spawnFakeChildProcess);
  });

  afterEach(() => jest.clearAllMocks());

  it('run cdk synth command', async () => {
    await runExecutorToExit(spawnMock, () => executor(options, context));
    expect(childProcess.spawn).toHaveBeenCalledWith(
      nodeCommandWithRelativePath,
      expect.objectContaining({
        cwd: context.root,
        env: process.env,
        shell: true,
        stdio: 'inherit',
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
    await runExecutorToExit(spawnMock, () => executor(option, context));
    expect(childProcess.spawn).toHaveBeenCalledWith(
      `${nodeCommandWithRelativePath} ${stackName}`,
      expect.objectContaining({
        env: process.env,
        shell: true,
        stdio: 'inherit',
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
    await runExecutorToExit(spawnMock, () => executor(option, context));
    expect(childProcess.spawn).toHaveBeenCalledWith(
      `${nodeCommandWithRelativePath} --context ${contextOptionString}`,
      expect.objectContaining({
        env: process.env,
        shell: true,
        stdio: 'inherit',
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
    await runExecutorToExit(spawnMock, () => executor(option, context));
    const contextCmd = contextOptions
      .map((option) => `--context ${option}`)
      .join(' ');
    expect(childProcess.spawn).toHaveBeenCalledWith(
      `${nodeCommandWithRelativePath} ${contextCmd}`,
      expect.objectContaining({
        env: process.env,
        shell: true,
        stdio: 'inherit',
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
    await runExecutorToExit(spawnMock, () => executor(option, context));
    expect(childProcess.spawn).toHaveBeenCalledWith(
      `${nodeCommandWithRelativePath} --exclusively true`,
      expect.objectContaining({
        env: process.env,
        shell: true,
        stdio: 'inherit',
      })
    );

    expect(logger.debug).toHaveBeenLastCalledWith(
      `Executing command: ${nodeCommandWithRelativePath} --exclusively true`
    );
  });
});
