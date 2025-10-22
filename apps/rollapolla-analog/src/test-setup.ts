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

getTestBed().initTestEnvironment(TestingModule, platformBrowserTesting());
