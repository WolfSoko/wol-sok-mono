/**
 * Errors a batch catches on purpose and goes on past (one idle guest, one
 * ended ban, one replay must not stop the sweep). They reach Cloud Logging
 * as before and, through the sink {@link initErrorReports} sets in a
 * deployed function, Sentry: `withSentry` sees only what a handler throws.
 * This module stays free of Sentry, as every handler module does.
 *
 * {@link initErrorReports}: ./error-reports.ts
 */
import { logger } from 'firebase-functions/logger';

/** Receives a caught error and the fixed message it was logged with. */
export type CaughtErrorSink = (error: unknown, message: string) => void;

const NO_SINK: CaughtErrorSink = () => undefined;

let sink: CaughtErrorSink = NO_SINK;

/** Hands every later caught error to `next`; `null` takes the sink away. */
export function reportCaughtErrorsTo(next: CaughtErrorSink | null): void {
  sink = next ?? NO_SINK;
}

/**
 * Logs the caught error with its fields and reports it. `message` is a
 * fixed text and the only one that leaves for Sentry: ids stay in the
 * log's fields.
 */
export function logCaughtError(
  message: string,
  fields: { readonly error: unknown } & Readonly<Record<string, unknown>>
): void {
  logger.error(message, fields);
  sink(fields.error, message);
}

/**
 * The error's name and stack frames, without its message or cause, for an
 * error whose text may carry a secret (a body quoting Google's answer,
 * say): Sentry and the log still learn its type and where it was thrown.
 */
export function withoutMessage(error: unknown): Error {
  const stripped = new Error();
  stripped.name = error instanceof Error ? error.name : 'unknown';
  stripped.stack = [stripped.name, ...framesOf(error)].join('\n');
  return stripped;
}

/**
 * The frames of V8's stack, which starts with `name: message` (the
 * message may span lines); none when the stack starts otherwise.
 */
function framesOf(error: unknown): string[] {
  if (!(error instanceof Error) || error.stack === undefined) {
    return [];
  }
  const head =
    error.message === '' ? error.name : `${error.name}: ${error.message}`;
  if (!error.stack.startsWith(`${head}\n`)) {
    return [];
  }
  return error.stack.slice(head.length + 1).split('\n');
}
