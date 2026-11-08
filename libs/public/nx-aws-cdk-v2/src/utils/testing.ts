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

/** Stands in for the cdk process a mocked `child_process.exec` spawns. */
class FakeChildProcess extends EventEmitter {
  public readonly stdout = new EventEmitter();
  public readonly stderr = new EventEmitter();
}

/** A mock implementation for `exec` that hands out a new `FakeChildProcess`. */
export function spawnFakeChildProcess(): ChildProcess {
  return new FakeChildProcess() as unknown as ChildProcess;
}

/** The part of a mocked `exec` that tells which processes it returned. */
interface SpawningMock {
  mock: { results: ReadonlyArray<{ value: unknown }> };
}

/**
 * Starts an executor, then lets the process the mocked `exec` spawned last
 * close with `exitCode`, and returns the executor's result. The executor has
 * to call `exec` before its first `await`, as `runCommandProcess` does.
 */
export async function runExecutorToExit<T>(
  exec: SpawningMock,
  run: () => Promise<T>,
  exitCode = 0
): Promise<T> {
  const result = run();
  const spawned = exec.mock.results.at(-1)?.value;
  if (!(spawned instanceof FakeChildProcess)) {
    await result;
    throw new Error('The executor spawned no FakeChildProcess through exec.');
  }
  spawned.emit('close', exitCode);
  return result;
}
