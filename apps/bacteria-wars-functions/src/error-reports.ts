/**
 * Error reports to Sentry (project `bacteria-wars-functions`, owner's
 * decision of 2026-10-26): errors only, no personal data. `main.ts` starts
 * it once and wraps every exported handler in {@link withSentry}; the
 * handler modules stay free of it.
 */
import * as Sentry from '@sentry/node';
import type { ErrorEvent } from '@sentry/node';
// The workspace's version, which names the release tag: a root file, not a
// project's code (and no edge in the project graph).
// eslint-disable-next-line @nx/enforce-module-boundaries
import { version } from '../../../version.json';
import { SENTRY_DSN } from './config';

/** The release the release workflow creates in Sentry for the game. */
export const RELEASE = `bacteria-wars@v${version}`;

/**
 * How long a failed handler waits for its report to leave: an instance may
 * be frozen as soon as the handler returns.
 */
export const FLUSH_MS = 2000;

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
 * The handler, reporting what it throws before it throws it on: retries
 * and the platform's own error log stay as they were.
 */
export function withSentry<A extends unknown[], R>(
  handler: (...args: A) => R | Promise<R>
): (...args: A) => Promise<R> {
  return async (...args: A) => {
    try {
      return await handler(...args);
    } catch (error) {
      await reportError(error);
      throw error;
    }
  };
}
