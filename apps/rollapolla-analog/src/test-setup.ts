import '@analogjs/vitest-angular/setup-snapshots';
import { NgModule, provideZonelessChangeDetection } from '@angular/core';

import { getTestBed } from '@angular/core/testing';
import {
  provideClientHydration,
  withIncrementalHydration,
} from '@angular/platform-browser';
import {
  BrowserTestingModule,
  platformBrowserTesting,
} from '@angular/platform-browser/testing';

@NgModule({
  imports: [BrowserTestingModule],
  providers: [
    provideZonelessChangeDetection(),
    provideClientHydration(withIncrementalHydration()),
  ],
})
export class TestingModule {}

// jsdom has none; `@defer (on viewport)` then simply never triggers in tests
globalThis.IntersectionObserver ??= class {
  public readonly root = null;
  public readonly rootMargin = '';
  public readonly thresholds: readonly number[] = [];
  public observe(): void {}
  public unobserve(): void {}
  public disconnect(): void {}
  public takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
} as unknown as typeof IntersectionObserver;

getTestBed().initTestEnvironment(TestingModule, platformBrowserTesting());
