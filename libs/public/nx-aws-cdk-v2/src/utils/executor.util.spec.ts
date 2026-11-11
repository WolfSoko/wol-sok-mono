import * as childProcess from 'child_process';

import { runCommandProcess } from './executor.util';
import {
  FakeChildProcess,
  lastSpawned,
  spawnFakeChildProcess,
} from '../testing/executor';

jest.mock('child_process', () => ({
  ...jest.requireActual('child_process'),
  exec: jest.fn(),
}));

/** The listeners `runCommandProcess` may add to the parent process. */
function parentListenerCounts() {
  return {
    exit: process.listenerCount('exit'),
    sigterm: process.listenerCount('SIGTERM'),
    stdinData: process.stdin.listenerCount('data'),
  };
}

describe('runCommandProcess', () => {
  const execMock = jest.mocked(childProcess.exec);

  beforeEach(() => execMock.mockImplementation(spawnFakeChildProcess));

  afterEach(() => jest.clearAllMocks());

  /** Starts the command and hands out the process the mocked exec spawned. */
  function start(): { result: Promise<boolean>; spawned: FakeChildProcess } {
    const result = runCommandProcess('cdk deploy', '/root');
    const spawned = lastSpawned(execMock);
    if (!spawned) {
      throw new Error('runCommandProcess spawned no process.');
    }
    return { result, spawned };
  }

  it.each([
    [0, true],
    [1, false],
  ])(
    'leaves no parent listener behind once the process exits with %i',
    async (exitCode, expected) => {
      const before = parentListenerCounts();
      const { result, spawned } = start();
      expect(parentListenerCounts()).toEqual({
        exit: before.exit + 1,
        sigterm: before.sigterm + 1,
        stdinData: before.stdinData + 1,
      });

      spawned.emit('close', exitCode);

      await expect(result).resolves.toBe(expected);
      expect(parentListenerCounts()).toEqual(before);
    }
  );

  it('lets stdin flow while the process runs and pauses it after', async () => {
    for (const run of [1, 2]) {
      const { result, spawned } = start();
      expect({ run, flowing: process.stdin.readableFlowing }).toEqual({
        run,
        flowing: true,
      });

      spawned.emit('close', 0);
      await result;

      expect({ run, flowing: process.stdin.readableFlowing }).toEqual({
        run,
        flowing: false,
      });
    }
  });

  it('forwards stdin data to the process and closes its stdin', async () => {
    const { result, spawned } = start();

    process.stdin.emit('data', 'y\n');

    expect(spawned.stdinWritten).toEqual(['y\n']);
    expect(spawned.stdinEnded).toBe(true);
    spawned.emit('close', 0);
    await result;
  });

  it('kills the process when the parent gets SIGTERM', async () => {
    const before = process.listeners('SIGTERM');
    const { result, spawned } = start();
    const added = process
      .listeners('SIGTERM')
      .filter((listener) => !before.includes(listener));

    added.forEach((listener) => listener('SIGTERM'));

    expect(spawned.killed).toBe(true);
    spawned.emit('close', null);
    await result;
  });
});
