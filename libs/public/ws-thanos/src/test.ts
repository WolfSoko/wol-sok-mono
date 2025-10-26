// This file is required by karma.conf.cjs and loads recursively all the .spec and framework files
import { NgModule, provideZonelessChangeDetection } from '@angular/core';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserTestingModule,
  platformBrowserTesting,
} from '@angular/platform-browser/testing';

@NgModule({
  imports: [BrowserTestingModule],
  providers: [provideZonelessChangeDetection()],
})
export class TestingModule {}
// First, initialize the Angular testing environment.
getTestBed().initTestEnvironment(TestingModule, platformBrowserTesting());
