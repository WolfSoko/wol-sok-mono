import {
  APP_INITIALIZER,
  enableProdMode,
  ErrorHandler,
  importProvidersFrom,
} from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { Router, RouterModule } from '@angular/router';
import { enableAkitaProdMode } from '@datorama/akita';
import * as Sentry from '@sentry/angular';
import { BrowserTracing } from '@sentry/tracing';
import { provideWsThanosOptions } from '@wolsok/ws-thanos';
import { APP_ROUTES, DEFAULT_APP_ROUTE } from './app/app-routes';
import { AppComponent } from './app/app.component';
import { CoreModule } from './app/core/core.module';
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
bootstrapApplication(AppComponent, {

  providers: [
    importProvidersFrom(CoreModule),
    {
      provide: ErrorHandler,
      useValue: Sentry.createErrorHandler({
        showDialog: true,
      }),
    },
    {
      provide: Sentry.TraceService,
      deps: [Router],
    },
    {
      provide: APP_INITIALIZER,
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      useFactory: () => () => {
      },
      deps: [Sentry.TraceService],
      multi: true,
    },
    importProvidersFrom(RouterModule.forRoot([...APP_ROUTES, DEFAULT_APP_ROUTE], {
      paramsInheritanceStrategy: 'always',
    })),
    [
      provideWsThanosOptions({
        maxParticleCount: 50000,
        animationLength: 5000,
      }),
    ],
  ],
})
  .catch((err) => console.error(err));

// platformBrowserDynamic().bootstrapModule(AppModule).then(moduleRef => {
//   const applicationRef = moduleRef.injector.get(ApplicationRef);
//   const componentRef = applicationRef.components[0];
//   // allows to run `ng.profiler.timeChangeDetection();`
//   enableDebugTools(componentRef);
// }).catch(err => window['console'].error(err));
