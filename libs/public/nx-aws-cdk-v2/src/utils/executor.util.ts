import { type ChildProcess, exec } from 'child_process';

import { DeployExecutorSchema } from '../executors/deploy/schema';
import { ParsedExecutorInterface } from '../interfaces/parsed-executor.interface';
import {
  ExecutorContext,
  logger,
  getPackageManagerCommand,
  workspaceRoot,
} from '@nx/devkit';
import { BootstrapExecutorSchema } from '../executors/bootstrap/schema';
import { SynthExecutorSchema } from '../executors/synth/schema';
import * as path from 'node:path';

/**
 * Project paths the CDK command is built from. Every executor needs both, so a
 * context without a resolvable project configuration is a hard error rather
 * than an `undefined` that only surfaces later in a malformed command.
 */
export function resolveProjectPaths(context: ExecutorContext): {
  sourceRoot: string;
  root: string;
} {
  const project = context.projectName
    ? context.projectsConfigurations?.projects[context.projectName]
    : undefined;

  if (!project) {
    throw new Error(
      `Cannot resolve the project configuration for "${
        context.projectName ?? '<unknown project>'
      }".`
    );
  }

  return { sourceRoot: project.sourceRoot ?? project.root, root: project.root };
}

export const executorPropKeys = ['stacks'];
export const LARGE_BUFFER = 1024 * 1000000;

/**
 * Root of the Nx workspace the executor runs in. Nx sets `NX_WORKSPACE_ROOT`
 * for every task it spawns; the devkit's `workspaceRoot` is the fallback for
 * the cases where it doesn't (e.g. when an executor is invoked programmatically).
 * Resolved lazily so importing this module never throws.
 */
function getWorkspaceRoot(): string {
  return process.env.NX_WORKSPACE_ROOT || workspaceRoot;
}

export function generateCommandString(command: string, appPath: string) {
  // `exec` is the package manager's "run a binary from node_modules" form:
  // npx, `pnpm exec` (or pnpx on older pnpm), yarn, bun. Deriving it by hand
  // produced `pnpm tsx`, which pnpm reads as a script name, not a binary.
  const { exec: packageManagerExecutor } = getPackageManagerCommand();

  const projectPath = path.join(getWorkspaceRoot(), appPath);
  // tsx resolves the tsconfig `paths` of the app on its own, so the CDK entry
  // can import workspace aliases. ts-node needed tsconfig-paths for that, and
  // tsconfig-paths silently resolves nothing once `baseUrl` is gone — which
  // TypeScript 6 deprecates. `--tsconfig` is required: without it tsx reads
  // whatever tsconfig sits next to the current working directory.
  const tsConfigPath = path.join(projectPath, 'tsconfig.app.json');
  const mainTsPath = path.join(projectPath, 'src', 'main.ts');
  const generatePath = `${packageManagerExecutor} tsx --tsconfig ${tsConfigPath} ${mainTsPath}`;
  return `${packageManagerExecutor} cdk -a "${generatePath}" ${command}`;
}

export function parseArgs(
  options: DeployExecutorSchema | BootstrapExecutorSchema | SynthExecutorSchema
): Record<string, string | string[]> {
  const keys = Object.keys(options);
  return keys
    .filter((prop) => executorPropKeys.indexOf(prop) < 0)
    .reduce(
      (acc, key) => {
        acc[key] = (options as Record<string, string | string[]>)[key];
        return acc;
      },
      {} as Record<string, string | string[]>
    );
}

export function createCommand(
  command: string,
  options: ParsedExecutorInterface
): string {
  logger.debug(`Normalized executor options: ${JSON.stringify(options)}`);

  const nodeCommandWithRelativePath = generateCommandString(
    command,
    options.root
  );
  const commands = [nodeCommandWithRelativePath];

  if (typeof options.stacks === 'string') {
    commands.push(options.stacks);
  }

  // If there are additional parsed arguments, append them appropriately
  if (options.parseArgs) {
    for (const arg in options.parseArgs) {
      const parsedArg = options.parseArgs[arg];
      if (Array.isArray(parsedArg)) {
        parsedArg.forEach((value) => {
          commands.push(`--${arg} ${value}`);
        });
      } else {
        commands.push(`--${arg} ${parsedArg}`);
      }
    }
  }

  return commands.join(' ');
}

export function runCommandProcess(
  command: string,
  cwd: string
): Promise<boolean> {
  return new Promise((resolve) => {
    logger.debug(`Executing command: ${command}`);

    const childProcess = exec(command, {
      maxBuffer: LARGE_BUFFER,
      env: process.env,
      cwd: cwd,
    });
    const unbindFromParentProcess = bindToParentProcess(childProcess);

    childProcess.stdout?.on('data', (data) => {
      process.stdout.write(data);
    });

    childProcess.stderr?.on('data', (err) => {
      process.stderr.write(err);
    });

    childProcess.on('close', (code) => {
      unbindFromParentProcess();
      resolve(code === 0);
    });
  });
}

/**
 * Ties the child to the parent process: the child is killed when the parent
 * exits or gets SIGTERM, and the parent's stdin is forwarded to it once.
 * Returns the function that removes every listener this added and pauses
 * stdin again once no other `data` listener is left (Node keeps a stream
 * flowing after its last `data` listener goes, which keeps the process alive).
 */
function bindToParentProcess(childProcess: ChildProcess): () => void {
  const killChild = () => childProcess.kill();
  const forwardStdin = (data: unknown) => {
    childProcess.stdin?.write(data);
    childProcess.stdin?.end();
  };

  process.on('exit', killChild);
  process.on('SIGTERM', killChild);
  // Resumed explicitly: a stream paused by an earlier run's cleanup stays
  // paused when a `data` listener is added.
  process.stdin.on('data', forwardStdin).resume();

  return () => {
    process.removeListener('exit', killChild);
    process.removeListener('SIGTERM', killChild);
    process.stdin.removeListener('data', forwardStdin);
    if (process.stdin.listenerCount('data') === 0) {
      process.stdin.pause();
    }
  };
}
