import '@angular/platform-server/init';

import { enableProdMode } from '@angular/core';
import {
  bootstrapApplication,
  BootstrapContext,
} from '@angular/platform-browser';
import { renderApplication } from '@angular/platform-server';

import { AppComponent } from './app/app.component';
import { config } from './app/app.config.server';

if (import.meta.env.PROD) {
  enableProdMode();
}

const bootstrap = (context: BootstrapContext) =>
  bootstrapApplication(AppComponent, config, context);

export default async function render(url: string, document: string) {
  const html = await renderApplication(bootstrap, {
    document,
    url,
  });
  return html;
}
