import { ApplicationConfig } from '@angular/core';
import { provideRouter, withEnabledBlockingInitialNavigation } from '@angular/router';
import { environment } from '../environments/environment';
import { appRoutes } from './app.routes';
import { provideRollapollaFirebase } from './provide-rollapolla.firebase';

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(appRoutes, withEnabledBlockingInitialNavigation()), provideRollapollaFirebase(environment)],
};
