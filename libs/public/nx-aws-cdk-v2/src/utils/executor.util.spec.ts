import * as childProcess from 'child_process';
import { getEventListeners } from 'events';

import { runCommandProcess } from './executor.util';
import {
  expectedSpawnOptions,
  FakeChildProcess,
  lastSpawned,
  spawnFakeChildProcess,
} from '../testing/executor';

jest.mock('child_process', () => ({
  ...jest.requireActual('child_process'),
  spawn: jest.fn(),
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
  const spawnMock = jest.mocked(childProcess.spawn);

  beforeEach(() => spawnMock.mockImplementation(spawnFakeChildProcess));

  afterEach(async () => {
    // Closes a process a failed expectation left running, so its listeners
    // do not leak into the next spec.
    const spawned = lastSpawned(spawnMock);
    if (spawned && !spawned.closed) {
      spawned.emit('close', 0, null);
    }
    await Promise.resolve();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  /** Starts the command and hands out the process the mocked spawn started. */
  function start(): { result: Promise<boolean>; spawned: FakeChildProcess } {
    const result = runCommandProcess('cdk deploy', '/root');
    const spawned = lastSpawned(spawnMock);
    if (!spawned) {
      throw new Error('runCommandProcess spawned no process.');
    }
    return { result, spawned };
  }

  type ParentEvent = 'exit' | 'SIGTERM';

  /** The `event` listeners of the parent process, to compare later. */
  function parentListeners(event: ParentEvent): readonly unknown[] {
    return getEventListeners(process, event);
  }

  /** Calls the `event` listeners added to the parent since `before`. */
  function callAddedListeners(
    event: ParentEvent,
    before: readonly unknown[],
    arg: unknown
  ): void {
    getEventListeners(process, event)
      .filter((listener) => !before.includes(listener))
      .forEach((listener) => listener(arg));
  }

  it('runs the command in a shell that shares the parent stdio', async () => {
    const { result, spawned } = start();

    expect(spawnMock).toHaveBeenCalledWith(
      'cdk deploy',
      expectedSpawnOptions('/root')
    );
    spawned.emit('close', 0, null);
    await result;
  });

  it.each([
    [0, true],
    [1, false],
    [null, false],
  ])(
    'leaves no parent listener behind once the process closes with %p',
    async (exitCode, expected) => {
      const before = parentListenerCounts();
      const { result, spawned } = start();
      expect(parentListenerCounts()).toEqual({
        exit: before.exit + 1,
        sigterm: before.sigterm + 1,
        stdinData: before.stdinData,
      });

      spawned.emit('close', exitCode, null);

      await expect(result).resolves.toBe(expected);
      expect(parentListenerCounts()).toEqual(before);
    }
  );

  it('resolves false and leaves no listener behind when the spawn fails', async () => {
    const before = parentListenerCounts();
    const { result, spawned } = start();

    spawned.emit('error', new Error('spawn /bin/sh ENOENT'));

    await expect(result).resolves.toBe(false);
    expect(parentListenerCounts()).toEqual(before);
  });

  it('kills the process when the parent exits', async () => {
    const before = parentListeners('exit');
    const { result, spawned } = start();

    callAddedListeners('exit', before, 0);

    expect(spawned.killSignals).toEqual([undefined]);
    spawned.emit('close', null, 'SIGTERM');
    await result;
  });

  it('forwards SIGTERM and re-raises it once the process closed', async () => {
    const kill = jest.spyOn(process, 'kill').mockReturnValue(true);
    const before = parentListeners('SIGTERM');
    const { result, spawned } = start();
    const counts = parentListenerCounts();

    callAddedListeners('SIGTERM', before, 'SIGTERM');

    expect(spawned.killSignals).toEqual(['SIGTERM']);
    expect(kill).not.toHaveBeenCalled();

    spawned.emit('close', null, 'SIGTERM');

    expect(parentListenerCounts()).toEqual({
      ...counts,
      exit: counts.exit - 1,
      sigterm: counts.sigterm - 1,
    });
    expect(kill).toHaveBeenCalledWith(process.pid, 'SIGTERM');
    const settled = await Promise.race([
      result.then(() => 'settled'),
      new Promise((resolve) => setTimeout(() => resolve('pending'), 10)),
    ]);
    expect(settled).toBe('pending');
  });
});
