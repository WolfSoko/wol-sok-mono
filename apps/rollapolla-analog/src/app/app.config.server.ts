import { ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideServerRendering } from '@angular/platform-server';
import { provideDataAccessServer } from '@wolsok/shared-data-access';
import { dataAccessOptions } from '../data-access.options';
import { appConfig } from './app.config';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(),
    provideNoopAnimations(),
    provideDataAccessServer(dataAccessOptions),
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
