import type { EnvironmentProviders } from '@angular/core';

/**
 * `provideGameCloud` for the admin specs (mapped in `jest.config.cts`): the
 * real one loads the Firebase SDK, which Jest cannot run. Specs provide a
 * fake `GameCloud` instead.
 */
export function provideGameCloud(): EnvironmentProviders[] {
  return [];
}
