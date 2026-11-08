import { constants } from 'node:os';

/** How a command's process ended. */
export type RunOutcome =
  | { kind: 'exit'; code: number }
  | { kind: 'signal'; signal: NodeJS.Signals }
  | { kind: 'start-error'; message: string };

export interface RetryDeps {
  pause: (ms: number) => Promise<unknown>;
  log: (line: string) => void;
  /** Time between the failed first attempt and the retry. */
  pauseMs?: number;
}

/** Long enough for a hiccup of Google's API to pass, short beside a deploy. */
const RETRY_PAUSE_MS = 30_000;
const SHELL_SIGNAL_OFFSET = 128;
const START_ERROR_CODE = 1;

/**
 * Runs a deploy and, when it fails, once more after a pause: a transient
 * error of the platform heals on the retry, a real one fails both attempts.
 * A deploy ended by a signal (a cancelled job) or one that could not start
 * is not retried. Resolves to the exit code the caller should exit with.
 */
export async function runWithOneRetry(
  run: () => Promise<RunOutcome>,
  { pause, log, pauseMs = RETRY_PAUSE_MS }: RetryDeps
): Promise<number> {
  const first = await run();
  if (first.kind !== 'exit' || first.code === 0) {
    return exitCodeOf(first, log);
  }
  log(
    `::warning::Deploy attempt 1 of 2 failed with exit code ${first.code}; retrying in ${pauseMs / 1000} s.`
  );
  await pause(pauseMs);

  const second = await run();
  if (second.kind === 'exit' && second.code === 0) {
    log('Deploy attempt 2 of 2 succeeded.');
  } else if (second.kind === 'exit') {
    log(
      `::error::Deploy failed: both attempts failed, the last with exit code ${second.code}.`
    );
  }
  return exitCodeOf(second, log);
}

function exitCodeOf(outcome: RunOutcome, log: RetryDeps['log']): number {
  switch (outcome.kind) {
    case 'exit':
      return outcome.code;
    case 'signal':
      log(`::error::Deploy ended by ${outcome.signal}, not retried.`);
      return SHELL_SIGNAL_OFFSET + (constants.signals[outcome.signal] ?? 0);
    case 'start-error':
      log(`::error::Deploy could not start: ${outcome.message}. Not retried.`);
      return START_ERROR_CODE;
  }
}
