/**
 * Runs a command and retries it once when it fails, for deploys that fail
 * on a transient error of the platform (#2838).
 *
 * Usage: tsx apps/bacteria-wars-functions/deploy/retry-once.ts <command> [args...]
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { RunOutcome, runWithOneRetry } from './run-with-one-retry';

const USAGE_EXIT_CODE = 2;

function runCommand([command, ...args]: string[]): Promise<RunOutcome> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', (error) => {
      console.error(`Could not start ${command}: ${error.message}`);
      resolve({ code: 1 });
    });
    child.on('close', (code, signal) => resolve({ code, signal }));
  });
}

async function main(): Promise<number> {
  const command = process.argv.slice(2);
  if (command.length === 0) {
    console.error('Usage: retry-once.ts <command> [args...]');
    return USAGE_EXIT_CODE;
  }
  return runWithOneRetry(() => runCommand(command), {
    pause: (ms) => sleep(ms),
    log: (line) => console.log(line),
  });
}

process.exit(await main());
