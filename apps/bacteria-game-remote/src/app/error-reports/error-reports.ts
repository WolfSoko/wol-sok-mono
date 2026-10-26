import {
  EnvironmentProviders,
  ErrorHandler,
  makeEnvironmentProviders,
} from '@angular/core';
import * as Sentry from '@sentry/angular';
import { scrubBreadcrumb, scrubEvent } from './scrub';

/** Where the game's error reports go: only the live site sets it. */
export interface ErrorReportOptions {
  /** The DSN of the Sentry project `bacteria-wars`, public by design. */
  dsn: string;
  environment: string;
  /** `bacteria-wars@v<version>`, the release the release workflow creates. */
  release: string;
}

/**
 * Default integrations the game leaves out: console breadcrumbs (the game
 * logs ids there) and release health (a session is a request on every
 * start, not an error).
 */
const DROPPED_INTEGRATIONS = new Set(['Console', 'BrowserSession']);

/** The data the SDK collects by itself: nothing about the player. */
export const NO_PERSONAL_DATA: Sentry.BrowserOptions['dataCollection'] = {
  userInfo: false,
  cookies: false,
  httpHeaders: { request: { allow: ['User-Agent'] }, response: false },
  httpBodies: [],
  urlQueryParams: false,
  stackFrameVariables: false,
};

/**
 * The SDK's settings (the owner's decision of 2026-10-26): errors only, no
 * personal data - no tracing, no Session Replay, no sessions, no IP
 * address, no console breadcrumbs, and the URLs without query and hash.
 */
export function sentryOptions(
  options: ErrorReportOptions
): Sentry.BrowserOptions {
  return {
    dsn: options.dsn,
    environment: options.environment,
    release: options.release,
    // What `sendDefaultPii: false` was before SDK 11: no user and no IP
    // address (Sentry would read it from the request), no cookies, no
    // query, no bodies; of the headers only the browser's user agent.
    dataCollection: NO_PERSONAL_DATA,
    integrations: (defaults) =>
      defaults.filter(
        (integration) => !DROPPED_INTEGRATIONS.has(integration.name)
      ),
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  };
}

/**
 * Starts Sentry for the game on its own site, PWA and Android app alike -
 * never in the shell, which loads only the exposed routes and has its own.
 * Without options (every build but production) it does nothing.
 */
export function startErrorReports(
  options: ErrorReportOptions | undefined
): void {
  if (options) {
    Sentry.init(sentryOptions(options));
  }
}

/** Angular's errors to Sentry, where {@link startErrorReports} started it. */
export function provideErrorReports(
  options: ErrorReportOptions | undefined
): EnvironmentProviders {
  return makeEnvironmentProviders(
    options
      ? [{ provide: ErrorHandler, useValue: Sentry.createErrorHandler() }]
      : []
  );
}
