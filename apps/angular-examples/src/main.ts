import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { enableAkitaProdMode } from '@datorama/akita';
import * as Sentry from '@sentry/angular';
import { BrowserTracing } from '@sentry/tracing';
import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
  enableAkitaProdMode();
}

Sentry.init({
  dsn: 'https://d7eab9a5f3484e48b3cf9c110533dcbe@o1384048.ingest.sentry.io/6702682',
  release: `angular-examples@${environment.version}`,
  integrations: [
    new BrowserTracing({
      tracingOrigins: [
        'localhost',
        'https://angularexamples.wolsok.de/',
        'https://angularexamples-b69f4.firebaseio.com',
      ],
      routingInstrumentation: Sentry.routingInstrumentation,
    }),
  ],

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 1.0,
});

// persistState({exclude: ['performance-test', 'wasm-test', 'input-wave', 'game-state', 'bacteria-player']});
platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .catch((err) => console.error(err));

// platformBrowserDynamic().bootstrapModule(AppModule).then(moduleRef => {
//   const applicationRef = moduleRef.injector.get(ApplicationRef);
//   const componentRef = applicationRef.components[0];
//   // allows to run `ng.profiler.timeChangeDetection();`
//   enableDebugTools(componentRef);
// }).catch(err => window['console'].error(err));
