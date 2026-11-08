import { provideFileRouter } from '@analogjs/router';
import {
  ApplicationConfig,
  provideZonelessChangeDetection,
} from '@angular/core';
import { withComponentInputBinding } from '@angular/router';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideFileRouter(withComponentInputBinding()),
  ],
};
