import {
  EnvironmentProviders,
  ErrorHandler,
  Injectable,
  makeEnvironmentProviders,
} from '@angular/core';
import type { BrowserOptions } from '@sentry/angular';
import { scrubBreadcrumb, scrubEvent } from './scrub';

/** Where an app's error reports go: only its production environment sets it. */
export interface ErrorReportOptions {
  /** The DSN of the app's Sentry project, public by design. */
  dsn: string;
  environment: string;
  /**
   * `<project>@v<version>` (`releaseName` of `@wolsok/utils-version`), the
   * release `.github/actions/create-release` creates.
   */
  release: string;
}

/**
 * Default integrations the apps leave out: console breadcrumbs (the apps
 * log ids there) and release health (a session is a request on every
 * start, not an error).
 */
const DROPPED_INTEGRATIONS = new Set(['Console', 'BrowserSession']);

/** The data the SDK collects by itself: nothing about the visitor. */
const NO_PERSONAL_DATA: BrowserOptions['dataCollection'] = {
  userInfo: false,
  cookies: false,
  httpHeaders: { request: { allow: ['User-Agent'] }, response: false },
  httpBodies: [],
  urlQueryParams: false,
  stackFrameVariables: false,
};

/**
 * The SDK's settings (the owner's decision of 2026-10-26 for the game,
 * since #3236 for every app): errors only, no
 * personal data - no tracing, no Session Replay, no sessions, no IP
 * address, no console breadcrumbs, and the URLs without query and hash.
 */
export function sentryOptions(options: ErrorReportOptions): BrowserOptions {
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
 * The SDK once started - loaded after the app's first render is under
 * way, not before it: a chunk of its own, never on the start's path.
 */
let sdk: Promise<typeof import('./sdk')> | undefined;

/**
 * Starts Sentry from an app's own bootstrap (the shell, the game on its own
 * site, PWA and Android app), never from an exposed module: each app
 * bundles its own copy of this lib (skipped in `workspace-federation.js`).
 * Without options (every build but production) it does nothing.
 */
export function startErrorReports(
  options: ErrorReportOptions | undefined
): void {
  if (options && !sdk) {
    sdk = import('./sdk').then((Sentry) => {
      Sentry.init(sentryOptions(options));
      return Sentry;
    });
  }
}

/**
 * Reports an error once the SDK is there: an error from before it loaded
 * waits for it, after `init`. Without a started SDK it does nothing.
 */
export function reportError(error: unknown): void {
  void sdk?.then((Sentry) => Sentry.captureException(error));
}

/** Angular's handler, which logs the error, and a report of it. */
@Injectable()
class ReportingErrorHandler extends ErrorHandler {
  public override handleError(error: unknown): void {
    super.handleError(error);
    reportError(error);
  }
}

/** Angular's errors to Sentry, where {@link startErrorReports} started it. */
export function provideErrorReports(
  options: ErrorReportOptions | undefined
): EnvironmentProviders {
  return makeEnvironmentProviders(
    options ? [{ provide: ErrorHandler, useClass: ReportingErrorHandler }] : []
  );
}
