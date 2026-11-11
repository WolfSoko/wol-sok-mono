/**
 * Runs a deploy command and retries it once when it fails, so a transient
 * error of the platform does not fail the release (#2838).
 *
 * Usage: tsx --tsconfig tools/tsconfig.tools.json tools/deploy/retry-once.ts <command> [args...]
 * `RETRY_PAUSE_MS` overrides the pause before the retry (the specs set 0).
 */
import { ChildProcess, spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { RunOutcome, runWithOneRetry } from './run-with-one-retry';

const USAGE_EXIT_CODE = 2;

/** The running deploy, which a cancel of the job is forwarded to. */
let current: ChildProcess | null = null;
/** The signal that cancelled the job, if one did: no retry after it. */
let cancelledBy: NodeJS.Signals | null = null;

function onCancel(signal: NodeJS.Signals): void {
  cancelledBy = signal;
  current?.kill(signal);
}

function runCommand([command, ...args]: string[]): Promise<RunOutcome> {
  return new Promise((resolve) => {
    current = spawn(command, args, { stdio: 'inherit' });
    current.on('error', (error) =>
      resolve({ kind: 'start-error', message: `${command}: ${error.message}` })
    );
    current.on('close', (code, signal) => {
      const endedBy = signal ?? cancelledBy;
      resolve(
        endedBy
          ? { kind: 'signal', signal: endedBy }
          : { kind: 'exit', code: code ?? 1 }
      );
    });
  });
}

function pauseOverride(): number | undefined {
  const ms = Number(process.env['RETRY_PAUSE_MS'] || NaN);
  return ms >= 0 ? ms : undefined;
}

async function main(): Promise<number> {
  const command = process.argv.slice(2);
  if (command.length === 0) {
    console.error('Usage: retry-once.ts <command> [args...]');
    return USAGE_EXIT_CODE;
  }
  process.on('SIGINT', onCancel);
  process.on('SIGTERM', onCancel);
  return runWithOneRetry(() => runCommand(command), {
    pause: sleep,
    log: console.log,
    pauseMs: pauseOverride(),
  });
}

// No top-level await: outside a `"type": "module"` package tsx emits CommonJS.
void main().then((code) => process.exit(code));
