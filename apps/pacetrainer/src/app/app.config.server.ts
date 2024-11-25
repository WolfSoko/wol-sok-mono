import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideServerRendering } from '@angular/platform-server';

import { appConfig } from './app.config';

const serverConfig: ApplicationConfig = {
  providers: [provideNoopAnimations(), provideServerRendering()],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
