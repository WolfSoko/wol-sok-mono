import '@analogjs/vitest-angular/setup-snapshots';
import {
  NgModule,
  provideZonelessChangeDetection,
} from '@angular/core';

import { getTestBed } from '@angular/core/testing';

import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

@NgModule({
  imports: [BrowserDynamicTestingModule],
  providers: [provideZonelessChangeDetection()],
})
export class TestingModule {}

getTestBed().initTestEnvironment(
  TestingModule,
  platformBrowserDynamicTesting()
);
