import * as childProcess from 'child_process';

import { logger } from '@nx/devkit';

import { DestroyExecutorSchema } from './schema';
import executor from './destroy';
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

const options: DestroyExecutorSchema = {};

const nodeCommandWithRelativePath = generateCommandString(
  'destroy',
  'apps/proj'
);

describe('aws-cdk-v2 Destroy Executor', () => {
  const context = mockExecutorContext('destroy');
  const spawnMock = jest.mocked(childProcess.spawn);

  beforeEach(() => {
    jest.spyOn(logger, 'debug');
    spawnMock.mockImplementation(spawnFakeChildProcess);
  });

  afterEach(() => jest.clearAllMocks());

  it('run cdk destroy command', async () => {
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

  it('run cdk destroy command stack', async () => {
    const option: DestroyExecutorSchema = Object.assign({}, options);
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
});
