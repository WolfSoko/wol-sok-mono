/**
 * Runs a deploy command and retries it once when it fails, so a transient
 * error of the platform does not fail the release (#2838).
 *
 * Usage: tsx apps/bacteria-wars-functions/deploy/retry-once.ts <command> [args...]
 * `RETRY_PAUSE_MS` overrides the pause before the retry (the specs set 0).
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import {
  RETRY_PAUSE_MS,
  RunOutcome,
  runWithOneRetry,
} from './run-with-one-retry';

const USAGE_EXIT_CODE = 2;
const CANCEL_SIGNALS: readonly NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

/** The signal that cancelled this job, if one did: no retry after it. */
let cancelledBy: NodeJS.Signals | null = null;

function runCommand([command, ...args]: string[]): Promise<RunOutcome> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    const forward = (signal: NodeJS.Signals) => child.kill(signal);
    CANCEL_SIGNALS.forEach((signal) => process.on(signal, forward));
    const settle = (outcome: RunOutcome) => {
      CANCEL_SIGNALS.forEach((signal) => process.off(signal, forward));
      resolve(outcome);
    };
    child.on('error', (error) =>
      settle({ code: null, startError: `${command}: ${error.message}` })
    );
    child.on('close', (code, signal) =>
      settle({ code, signal: signal ?? cancelledBy })
    );
  });
}

function pauseMs(): number {
  const override = process.env['RETRY_PAUSE_MS'];
  const ms = override ? Number(override) : NaN;
  return ms >= 0 ? ms : RETRY_PAUSE_MS;
}

async function main(): Promise<number> {
  const command = process.argv.slice(2);
  if (command.length === 0) {
    console.error('Usage: retry-once.ts <command> [args...]');
    return USAGE_EXIT_CODE;
  }
  CANCEL_SIGNALS.forEach((signal) =>
    process.on(signal, () => {
      cancelledBy = signal;
    })
  );
  return runWithOneRetry(() => runCommand(command), {
    pause: (ms) => sleep(ms),
    log: (line) => console.log(line),
    pauseMs: pauseMs(),
  });
}

process.exit(await main());
