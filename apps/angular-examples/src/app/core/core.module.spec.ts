import { ErrorHandler, NgModule } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import * as Sentry from '@sentry/angular';
import { provideCore } from './core.module';

jest.mock('@sentry/angular', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
}));

// The Firebase-bound parts of the shell's providers, which no spec reaches.
jest.mock('@wolsok/shared-data-access', () => ({
  provideDataAccess: () => [],
}));
jest.mock('@wolsok/feat-api-auth', () => {
  @NgModule({})
  class AuthModule {
    public static forRoot() {
      return { ngModule: AuthModule, providers: [] };
    }
  }
  return { AuthModule };
});

describe('the shell outside production', () => {
  it("starts no Sentry and keeps Angular's error handler", async () => {
    TestBed.configureTestingModule({ providers: [provideCore()] });

    // TestBed's own handler rethrows; the reporting one would report instead.
    expect(() =>
      TestBed.inject(ErrorHandler).handleError(new Error('in a component'))
    ).toThrow('in a component');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(Sentry.init).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});
