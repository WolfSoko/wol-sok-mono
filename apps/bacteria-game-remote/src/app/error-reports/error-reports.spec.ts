import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import * as Sentry from '@sentry/angular';
import { environment as development } from '../../environments/environment';
import { environment as e2e } from '../../environments/environment.e2e';
import { environment as emulator } from '../../environments/environment.emulator';
import { environment as production } from '../../environments/environment.prod';
import {
  ErrorReportOptions,
  provideErrorReports,
  sentryOptions,
  startErrorReports,
} from './error-reports';
import { scrubBreadcrumb, scrubEvent } from './scrub';

jest.mock('@sentry/angular', () => ({
  init: jest.fn(),
  createErrorHandler: jest.fn(() => ({ handleError: jest.fn() })),
}));

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

  it('start no Sentry without options', () => {
    startErrorReports(undefined);
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('start Sentry with the options, errors only and no personal data', () => {
    startErrorReports(OPTIONS);
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
      beforeSend: scrubEvent,
      beforeBreadcrumb: scrubBreadcrumb,
    });
    expect(options).not.toHaveProperty('tracesSampleRate');
    expect(options).not.toHaveProperty('replaysSessionSampleRate');
  });

  it('leave out console breadcrumbs and sessions', () => {
    const named = (name: string) => ({ name }) as Sentry.Integration;
    const integrations = sentryOptions(OPTIONS).integrations as (
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

  it("keep Angular's error handler without options", () => {
    TestBed.configureTestingModule({
      providers: [provideErrorReports(undefined)],
    });
    TestBed.inject(ErrorHandler);
    expect(Sentry.createErrorHandler).not.toHaveBeenCalled();
  });

  it("hand Angular's errors to Sentry with options", () => {
    TestBed.configureTestingModule({
      providers: [provideErrorReports(OPTIONS)],
    });
    const sentryHandler = jest.mocked(Sentry.createErrorHandler).mock.results[0]
      ?.value;
    expect(TestBed.inject(ErrorHandler)).toBe(sentryHandler);
  });
});
