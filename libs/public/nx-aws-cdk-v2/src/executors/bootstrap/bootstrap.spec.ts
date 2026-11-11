import * as childProcess from 'child_process';

import { logger } from '@nx/devkit';

import { BootstrapExecutorSchema } from './schema';
import executor from './bootstrap';
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

const options: BootstrapExecutorSchema = {};

const nodeCommandWithRelativePath = generateCommandString(
  'bootstrap',
  'apps/proj'
);

describe('aws-cdk-v2 Bootstrap Executor', () => {
  const context = mockExecutorContext('bootstrap');
  const execMock = jest.mocked(childProcess.exec);

  beforeEach(() => {
    jest.spyOn(logger, 'debug');
    execMock.mockImplementation(spawnFakeChildProcess);
  });

  afterEach(() => jest.clearAllMocks());

  it('run cdk bootstrap command', async () => {
    await runExecutorToExit(execMock, () => executor(options, context));
    expect(childProcess.exec).toHaveBeenCalledWith(
      nodeCommandWithRelativePath,
      expect.objectContaining({
        cwd: expect.stringContaining(context.root),
        env: process.env,
        maxBuffer: LARGE_BUFFER,
      })
    );
    expect(logger.debug).toHaveBeenLastCalledWith(
      `Executing command: ${nodeCommandWithRelativePath}`
    );
  });

  it('run cdk bootstrap command profile', async () => {
    const option: BootstrapExecutorSchema = Object.assign({}, options);
    const profile = 'prod';
    option['profile'] = profile;
    await runExecutorToExit(execMock, () => executor(option, context));
    expect(childProcess.exec).toHaveBeenCalledWith(
      `${nodeCommandWithRelativePath} --profile ${profile}`,
      expect.objectContaining({
        env: process.env,
        maxBuffer: LARGE_BUFFER,
      })
    );
    expect(logger.debug).toHaveBeenLastCalledWith(
      `Executing command: ${nodeCommandWithRelativePath} --profile ${profile}`
    );
  });
});
