import 'zone.js';
import { mergeApplicationConfig } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideDataAccess } from '@wolsok/shared-data-access';

import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { dataAccessOptions } from './data-access.options';

bootstrapApplication(
  AppComponent,
  mergeApplicationConfig(appConfig, {
    providers: [provideAnimations(), provideDataAccess(dataAccessOptions)],
  })
).catch((err) => console.error(err));
