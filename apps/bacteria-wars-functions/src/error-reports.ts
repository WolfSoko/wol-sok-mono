/**
 * Error reports to Sentry (project `bacteria-wars-functions`, owner's
 * decision of 2026-10-26): errors only, no personal data. `main.ts` starts
 * it once and wraps every exported handler in {@link withSentry}; the
 * handler modules stay free of it.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import * as Sentry from '@sentry/node';
import type { ErrorEvent } from '@sentry/node';
import { releaseName } from '@wolsok/utils-version';
import { logger } from 'firebase-functions/logger';
import { reportCaughtErrorsTo } from './caught-errors';
import { SENTRY_DSN } from './config';

/** The release the release workflow creates in Sentry for the game. */
export const RELEASE = releaseName('bacteria-wars');

/**
 * How long a failed handler waits for its report to leave: an instance may
 * be frozen as soon as the handler returns.
 */
export const FLUSH_MS = 2000;

/**
 * How many caught errors of one message a handler run reports: a batch
 * failing for every item on the same cause would otherwise send an event
 * per item and use up the quota. The rest are only logged, and counted.
 */
export const CAUGHT_PER_MESSAGE = 5;

/** What one handler run captured of the errors its batches caught. */
interface CaughtInRun {
  /** Reported so far, by message. */
  readonly reported: Map<string, number>;
  /** Left out by {@link CAUGHT_PER_MESSAGE}, by message. */
  readonly skipped: Map<string, number>;
}

const run = new AsyncLocalStorage<CaughtInRun>();

/**
 * The SDK's default integrations that stay, all about the error itself:
 * no console or HTTP breadcrumbs (the handlers log uids), no request
 * data, no sessions, no instrumentation of other modules.
 */
const KEPT_INTEGRATIONS = new Set([
  'EventFilters',
  'FunctionToString',
  'LinkedErrors',
  'Dedupe',
  'NodeSystemError',
  'OnUncaughtException',
  'OnUnhandledRejection',
  'ContextLines',
  'Context',
]);

/**
 * True only in a deployed function: Cloud Run sets `K_SERVICE`, the
 * emulator sets it too but also `FUNCTIONS_EMULATOR`, and neither the
 * deploy's discovery of the functions nor Jest set it.
 */
export function runsDeployed(env: NodeJS.ProcessEnv): boolean {
  return (
    Boolean(env['K_SERVICE']) &&
    env['FUNCTIONS_EMULATOR'] !== 'true' &&
    env['JEST_WORKER_ID'] === undefined
  );
}

/**
 * Account and document ids, as Firestore errors name them in a path
 * (`players/<uid>/…`): 20 or more letters and digits with at least one of
 * each, or exactly a uid's 28 or an auto-id's 20 of them, which may hold no
 * digit.
 */
const ID =
  /\b(?=[A-Za-z0-9]*[A-Za-z])(?:(?=[A-Za-z0-9]*\d)[A-Za-z0-9]{20,}|[A-Za-z0-9]{28}|[A-Za-z0-9]{20})\b/g;

/** The text with every id-like token replaced by `<id>`. */
export function scrubIds(text: string): string {
  return text.replace(ID, '<id>');
}

/**
 * No user, no request beyond its path, and no ids in the messages - the
 * same rules as the game's reports.
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  delete event.user;
  // A thrown non-Error lands here serialized, ids and all.
  delete event.extra;
  if (event.request) {
    const url = event.request.url?.split(/[?#]/)[0];
    event.request = url === undefined ? {} : { url: scrubIds(url) };
  }
  if (event.message) {
    event.message = scrubIds(event.message);
  }
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) {
      exception.value = scrubIds(exception.value);
    }
  }
  return event;
}

/** Starts Sentry in a deployed function; true when it did. */
export function initErrorReports(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  if (!runsDeployed(env)) {
    return false;
  }
  Sentry.init({
    dsn: SENTRY_DSN,
    release: RELEASE,
    environment: 'production',
    // What `sendDefaultPii: false` was before SDK 11: no user, IP address,
    // cookies, headers, query, bodies or local variables.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      stackFrameVariables: false,
    },
    // No auto-instrumentation, so no module hooks on every later import.
    enableRuntimeChannelInjection: false,
    integrations: (defaults) =>
      defaults.filter((integration) => KEPT_INTEGRATIONS.has(integration.name)),
    initialScope: { tags: { function: env['K_SERVICE'] ?? 'unknown' } },
    beforeSend: scrubEvent,
    beforeBreadcrumb: () => null,
  });
  reportCaughtErrorsTo(captureCaughtError);
  return true;
}

/**
 * Reports the error and waits for it to leave. Without a started SDK
 * (emulator, tests, the deploy's discovery) it does nothing.
 */
export async function reportError(error: unknown): Promise<void> {
  Sentry.captureException(error);
  await Sentry.flush(FLUSH_MS);
}

/**
 * Reports an error a batch caught and went on past, tagged with the fixed
 * message it was logged with, at most {@link CAUGHT_PER_MESSAGE} of each
 * message in a handler run. `withSentry` flushes it before the run ends.
 */
export function captureCaughtError(error: unknown, message: string): void {
  const caught = run.getStore();
  if (caught) {
    const reported = caught.reported.get(message) ?? 0;
    if (reported >= CAUGHT_PER_MESSAGE) {
      caught.skipped.set(message, (caught.skipped.get(message) ?? 0) + 1);
      return;
    }
    caught.reported.set(message, reported + 1);
  }
  Sentry.captureException(error, { tags: { caught: message } });
}

/**
 * The handler, reporting what it throws before it throws it on: retries
 * and the platform's own error log stay as they were. Errors its batches
 * caught (see `captureCaughtError`) are flushed before it returns.
 */
export function withSentry<A extends unknown[], R>(
  handler: (...args: A) => R | Promise<R>
): (...args: A) => Promise<R> {
  return (...args: A) => {
    const caught: CaughtInRun = { reported: new Map(), skipped: new Map() };
    return run.run(caught, async () => {
      let result: R;
      try {
        result = await handler(...args);
      } catch (error) {
        logSkipped(caught);
        await reportError(error);
        throw error;
      }
      await settleCaught(caught);
      return result;
    });
  };
}

/** Sends what the run captured, if anything, and logs what it left out. */
async function settleCaught(caught: CaughtInRun): Promise<void> {
  logSkipped(caught);
  if (caught.reported.size > 0) {
    await Sentry.flush(FLUSH_MS).catch(() => false);
  }
}

function logSkipped(caught: CaughtInRun): void {
  if (caught.skipped.size > 0) {
    logger.warn('Caught errors not reported to Sentry', {
      skipped: Object.fromEntries(caught.skipped),
    });
  }
}
