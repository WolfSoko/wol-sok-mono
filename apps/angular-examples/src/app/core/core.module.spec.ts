import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import * as Sentry from '@sentry/angular';
import {
  provideErrorReports,
  startErrorReports,
} from '@wolsok/shared-error-reports';
import { environment } from '../../environments/environment';

jest.mock('@sentry/angular', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
}));

describe('error reports outside production', () => {
  it("start no Sentry and keep Angular's error handler", async () => {
    startErrorReports(environment.sentry);
    TestBed.configureTestingModule({
      providers: [provideErrorReports(environment.sentry)],
    });
    // TestBed's own handler rethrows; the reporting one would report instead.
    expect(() =>
      TestBed.inject(ErrorHandler).handleError(new Error('in a component'))
    ).toThrow('in a component');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(Sentry.init).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});
