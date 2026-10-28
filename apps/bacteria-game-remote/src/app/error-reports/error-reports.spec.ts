import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import * as Sentry from '@sentry/angular';
import { environment as development } from '../../environments/environment';
import { environment as e2e } from '../../environments/environment.e2e';
import { environment as emulator } from '../../environments/environment.emulator';
import { environment as production } from '../../environments/environment.prod';
import {
  type ErrorReportOptions,
  provideErrorReports,
  startErrorReports,
} from './error-reports';
import { scrubBreadcrumb, scrubEvent } from './scrub';

jest.mock('@sentry/angular', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
}));

/** The module afresh: each test starts without a started SDK. */
function errorReports(): typeof import('./error-reports') {
  let module: typeof import('./error-reports') | undefined;
  jest.isolateModules(() => {
    module = jest.requireActual('./error-reports');
  });
  if (!module) {
    throw new Error('error-reports did not load');
  }
  return module;
}

/** Lets the SDK's import and the reports queued on it settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const OPTIONS: ErrorReportOptions = {
  dsn: 'https://key@o1.ingest.us.sentry.io/2',
  environment: 'production',
  release: 'bacteria-wars@v1.2.3',
};

describe('error reports', () => {
  beforeEach(() => jest.clearAllMocks());

  it('start only on the live site', () => {
    expect(production.sentry).toEqual({
      dsn: expect.stringMatching(
        /^https:\/\/\w+@o1384048\.ingest\.us\.sentry\.io\/\d+$/
      ),
      environment: 'production',
      release: expect.stringMatching(/^bacteria-wars@v\d+\.\d+\.\d+$/),
    });
    for (const environment of [development, emulator, e2e]) {
      expect(environment.sentry).toBeUndefined();
    }
  });

  it('start no Sentry without options, and report nothing', async () => {
    const { reportError, startErrorReports } = errorReports();
    startErrorReports(undefined);
    reportError(new Error('lost'));
    await settle();
    expect(Sentry.init).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('start Sentry with the options, errors only and no personal data', async () => {
    errorReports().startErrorReports(OPTIONS);
    await settle();
    expect(Sentry.init).toHaveBeenCalledTimes(1);
    const options = jest.mocked(Sentry.init).mock.calls[0][0];
    expect(options).toMatchObject({
      dsn: OPTIONS.dsn,
      environment: 'production',
      release: 'bacteria-wars@v1.2.3',
      dataCollection: {
        userInfo: false,
        cookies: false,
        urlQueryParams: false,
      },
    });
    // The isolated module has a scrubber of its own: the same functions.
    expect(options?.beforeSend?.name).toBe(scrubEvent.name);
    expect(options?.beforeBreadcrumb?.name).toBe(scrubBreadcrumb.name);
    expect(options).not.toHaveProperty('tracesSampleRate');
    expect(options).not.toHaveProperty('replaysSessionSampleRate');
  });

  it('leave out console breadcrumbs and sessions', () => {
    const named = (name: string) => ({ name }) as Sentry.Integration;
    const integrations = errorReports().sentryOptions(OPTIONS).integrations as (
      defaults: Sentry.Integration[]
    ) => Sentry.Integration[];
    expect(
      integrations(
        ['GlobalHandlers', 'Console', 'Breadcrumbs', 'BrowserSession'].map(
          named
        )
      ).map(({ name }) => name)
    ).toEqual(['GlobalHandlers', 'Breadcrumbs']);
  });

  it('report an error from before the SDK loaded once it started', async () => {
    const { reportError, startErrorReports } = errorReports();
    startErrorReports(OPTIONS);
    const error = new Error('early');
    reportError(error);
    expect(Sentry.captureException).not.toHaveBeenCalled();

    await settle();
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
    expect(jest.mocked(Sentry.init).mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(Sentry.captureException).mock.invocationCallOrder[0]
    );
  });

  it("keep Angular's error handler without options", () => {
    TestBed.configureTestingModule({
      providers: [provideErrorReports(undefined)],
    });
    expect(TestBed.inject(ErrorHandler).constructor.name).not.toBe(
      'ReportingErrorHandler'
    );
  });

  it("log Angular's errors and hand them to Sentry with options", async () => {
    // The one test that starts this file's own module: its handler is
    // Angular's, which the isolated modules' copies are not.
    startErrorReports(OPTIONS);
    TestBed.configureTestingModule({
      providers: [provideErrorReports(OPTIONS)],
    });
    const logged = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const error = new Error('in a component');

    TestBed.inject(ErrorHandler).handleError(error);
    await settle();

    expect(logged).toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
    logged.mockRestore();
  });
});
