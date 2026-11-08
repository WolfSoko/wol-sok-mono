import { constants } from 'node:os';

/** How a command's process ended: its exit code, or the signal that ended it. */
export interface RunOutcome {
  code: number | null;
  signal?: NodeJS.Signals | null;
}

export interface RetryDeps {
  pause: (ms: number) => Promise<void>;
  log: (line: string) => void;
  /** Time between the failed first attempt and the retry. */
  pauseMs?: number;
}

/** Long enough for a hiccup of Google's API to pass, short beside a deploy. */
export const RETRY_PAUSE_MS = 30_000;

const ATTEMPTS = 2;
const SHELL_SIGNAL_OFFSET = 128;
const FALLBACK_FAILURE_CODE = 1;

/**
 * Runs `run` and, when it fails, once more after a pause: a transient error
 * of the platform heals on the retry, a real one fails both attempts.
 * A run ended by a signal (a cancelled job) is not retried.
 * Resolves to the exit code the caller should exit with.
 */
export async function runWithOneRetry(
  run: () => Promise<RunOutcome>,
  { pause, log, pauseMs = RETRY_PAUSE_MS }: RetryDeps
): Promise<number> {
  for (let attempt = 1; ; attempt++) {
    const { code, signal } = await run();
    if (signal) {
      log(
        `::error::Deploy attempt ${attempt} ended by ${signal}, not retried.`
      );
      return signalExitCode(signal);
    }
    if (code === 0) {
      if (attempt > 1)
        log(`Deploy attempt ${attempt} of ${ATTEMPTS} succeeded.`);
      return 0;
    }
    const failure = code ?? FALLBACK_FAILURE_CODE;
    if (attempt === ATTEMPTS) {
      log(
        `::error::Deploy failed: both attempts failed, the last with exit code ${failure}.`
      );
      return failure;
    }
    log(
      `::warning::Deploy attempt ${attempt} of ${ATTEMPTS} failed with exit code ${failure}; retrying in ${pauseMs / 1000} s.`
    );
    await pause(pauseMs);
  }
}

function signalExitCode(signal: NodeJS.Signals): number {
  return SHELL_SIGNAL_OFFSET + (constants.signals[signal] ?? 0);
}
