import * as childProcess from 'child_process';

import { logger } from '@nx/devkit';

import { BootstrapExecutorSchema } from './schema';
import executor from './bootstrap';
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

const options: BootstrapExecutorSchema = {};

const nodeCommandWithRelativePath = generateCommandString(
  'bootstrap',
  'apps/proj'
);

describe('aws-cdk-v2 Bootstrap Executor', () => {
  const context = mockExecutorContext('bootstrap');
  const spawnMock = jest.mocked(childProcess.spawn);

  beforeEach(() => {
    jest.spyOn(logger, 'debug');
    spawnMock.mockImplementation(spawnFakeChildProcess);
  });

  afterEach(() => jest.clearAllMocks());

  it('run cdk bootstrap command', async () => {
    await runExecutorToExit(spawnMock, () => executor(options, context));
    expect(childProcess.spawn).toHaveBeenCalledWith(
      nodeCommandWithRelativePath,
      expectedSpawnOptions(context.root)
    );
    expect(logger.debug).toHaveBeenLastCalledWith(
      `Executing command: ${nodeCommandWithRelativePath}`
    );
  });

  it('run cdk bootstrap command profile', async () => {
    const option: BootstrapExecutorSchema = Object.assign({}, options);
    const profile = 'prod';
    option['profile'] = profile;
    await runExecutorToExit(spawnMock, () => executor(option, context));
    expect(childProcess.spawn).toHaveBeenCalledWith(
      `${nodeCommandWithRelativePath} --profile ${profile}`,
      expectedSpawnOptions(context.root)
    );
    expect(logger.debug).toHaveBeenLastCalledWith(
      `Executing command: ${nodeCommandWithRelativePath} --profile ${profile}`
    );
  });
});
