import '@analogjs/vitest-angular/setup-snapshots';
import {
  NgModule,
  provideExperimentalZonelessChangeDetection,
} from '@angular/core';

import { getTestBed } from '@angular/core/testing';

import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

@NgModule({
  imports: [BrowserDynamicTestingModule],
  providers: [provideExperimentalZonelessChangeDetection()],
})
export class TestingModule {}

getTestBed().initTestEnvironment(
  TestingModule,
  platformBrowserDynamicTesting()
);
