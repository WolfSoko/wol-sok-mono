import * as childProcess from 'child_process';

import { logger } from '@nx/devkit';

import { DestroyExecutorSchema } from './schema';
import executor from './destroy';
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

const options: DestroyExecutorSchema = {};

const nodeCommandWithRelativePath = generateCommandString(
  'destroy',
  'apps/proj'
);

describe('aws-cdk-v2 Destroy Executor', () => {
  const context = mockExecutorContext('destroy');
  const execMock = jest.mocked(childProcess.exec);

  beforeEach(() => {
    jest.spyOn(logger, 'debug');
    execMock.mockImplementation(spawnFakeChildProcess);
  });

  afterEach(() => jest.clearAllMocks());

  it('run cdk destroy command', async () => {
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

  it('run cdk destroy command stack', async () => {
    const option: DestroyExecutorSchema = Object.assign({}, options);
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
});
