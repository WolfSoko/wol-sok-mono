import 'zone.js';
import { mergeApplicationConfig } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';

import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

bootstrapApplication(
  AppComponent,
  mergeApplicationConfig(appConfig, {
    providers: [provideAnimations()],
  })
).catch((err) => console.error(err));
