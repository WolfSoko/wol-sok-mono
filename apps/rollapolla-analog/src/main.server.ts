import '@angular/platform-server/init';

import { enableProdMode } from '@angular/core';
import {
  bootstrapApplication,
  BootstrapContext,
} from '@angular/platform-browser';
import { renderApplication } from '@angular/platform-server';
import { provideServerContext } from '@analogjs/router/server';
import { ServerContext } from '@analogjs/router/tokens';

import { AppComponent } from './app/app.component';
import { config } from './app/app.config.server';

if (import.meta.env.PROD) {
  enableProdMode();
}

const bootstrap = (context: BootstrapContext) =>
  bootstrapApplication(AppComponent, config, context);

export default async function render(
  url: string,
  document: string,
  serverContext?: ServerContext
) {
  // lets pages answer with their own status code, see injectSetNotFoundStatus
  const html = await renderApplication(bootstrap, {
    document,
    url,
    platformProviders: serverContext ? provideServerContext(serverContext) : [],
  });
  return html;
}
