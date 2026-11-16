import type { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

import { ExecutorContext } from '@nx/devkit';

export function mockExecutorContext(
  executorName: string,
  workspaceVersion = 2
): ExecutorContext {
  return {
    projectName: 'proj',
    root: '/root',
    cwd: '/root',
    nxJsonConfiguration: {},
    projectsConfigurations: {
      version: workspaceVersion,
      projects: {
        proj: {
          root: 'apps/proj',
          targets: {
            test: {
              executor: `@wolsok/nx-aws-cdk-v2:${executorName}`,
            },
          },
        },
      },
    },
    projectGraph: { nodes: {}, dependencies: {} },
    target: {
      executor: `@wolsok/nx-aws-cdk-v2:${executorName}`,
    },
    isVerbose: true,
  };
}

/**
 * Stands in for the cdk process a mocked `child_process.spawn` starts. Its
 * stdio is the parent's (`stdio: 'inherit'`), so it has no streams of its own.
 */
export class FakeChildProcess extends EventEmitter {
  /** The signals the process was killed with, in order. */
  public readonly killSignals: Array<NodeJS.Signals | number | undefined> = [];

  public kill(signal?: NodeJS.Signals | number): boolean {
    this.killSignals.push(signal);
    return true;
  }
}

/** A mock implementation for `spawn` that hands out a new `FakeChildProcess`. */
export function spawnFakeChildProcess(): ChildProcess {
  return new FakeChildProcess() as unknown as ChildProcess;
}

/** The part of a mocked `spawn` that tells which processes it returned. */
interface SpawningMock {
  mock: { results: ReadonlyArray<{ value: unknown }> };
}

/**
 * Starts an executor, then lets the process the mocked `spawn` started last
 * close with `exitCode`, and returns the executor's result. The executor has
 * to call `spawn` before its first `await`, as `runCommandProcess` does.
 */
export async function runExecutorToExit<T>(
  spawn: SpawningMock,
  run: () => Promise<T>,
  exitCode = 0
): Promise<T> {
  const result = run();
  const spawned = lastSpawned(spawn);
  if (!spawned) {
    await result;
    throw new Error('The executor spawned no FakeChildProcess through spawn.');
  }
  spawned.emit('close', exitCode);
  return result;
}

/** The `FakeChildProcess` the mocked `spawn` returned last, if any. */
export function lastSpawned(spawn: SpawningMock): FakeChildProcess | undefined {
  const spawned = spawn.mock.results.at(-1)?.value;
  return spawned instanceof FakeChildProcess ? spawned : undefined;
}
