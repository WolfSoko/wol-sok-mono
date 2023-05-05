import { enableProdMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { enableAkitaProdMode } from '@datorama/akita';
import * as Sentry from '@sentry/angular-ivy';
import { provideWsThanosOptions } from '@wolsok/thanos';
import { provideAppRouter } from './app/app-routing';
import { AppComponent } from './app/app.component';
import { provideCore } from './app/core/core.module';
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
  enableAkitaProdMode();
}

Sentry.init({
  dsn: 'https://d7eab9a5f3484e48b3cf9c110533dcbe@o1384048.ingest.sentry.io/6702682',
  release: `angular-examples@${environment.version}`,
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  // eslint-disable-next-line no-magic-numbers
  replaysSessionSampleRate: 1,

  // If the entire session is not sampled, use the below sample rate to sample
  // sessions when an error occurs.
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    new Sentry.Replay(),
    new Sentry.BrowserTracing({
      tracePropagationTargets: ['https://angularexamples.wolsok.de/'],
      routingInstrumentation: Sentry.routingInstrumentation,
    }),
  ],

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 1.0,
});

bootstrapApplication(AppComponent, {
  providers: [
    provideAppRouter(),
    provideCore(),
    [
      provideWsThanosOptions({
        maxParticleCount: 50000,
        animationLength: 5000,
      }),
    ],
  ],
}).catch((err) => console.error(err));

// persistState({exclude: ['performance-test', 'wasm-test', 'input-wave', 'game-state', 'bacteria-player']});
// platformBrowserDynamic()
//   .bootstrapModule(AppModule, {
//     defaultEncapsulation: ViewEncapsulation.Emulated,
//   })
//   .catch((err) => console.error(err));

// platformBrowserDynamic().bootstrapModule(AppModule).then(moduleRef => {
//   const applicationRef = moduleRef.injector.get(ApplicationRef);
//   const componentRef = applicationRef.components[0];
//   // allows to run `ng.profiler.timeChangeDetection();`
//   enableDebugTools(componentRef);
// }).catch(err => window['console'].error(err));
