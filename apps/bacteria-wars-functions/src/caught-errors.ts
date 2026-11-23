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
