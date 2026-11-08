import {
  DestroyRef,
  DOCUMENT,
  inject,
  InjectionToken,
  isDevMode,
  makeEnvironmentProviders,
  provideAppInitializer,
  type EnvironmentProviders,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { provideServiceWorker, SwUpdate } from '@angular/service-worker';

/** Reloads the page; specs pass a fake. */
export const SEITE_NEU_LADEN = new InjectionToken<() => void>(
  'SEITE_NEU_LADEN',
  {
    providedIn: 'root',
    factory: () => {
      const document = inject(DOCUMENT);
      return () => document.location.reload();
    },
  }
);

/**
 * Angular's service worker (`ngsw-config.json`), which keeps the app shell
 * so the app opens offline. Only in a production build: the dev server
 * (`serve`, `serve-e2e`) has no `ngsw-worker.js`. A new release is taken
 * on the next load; only a worker that lost files of the release it serves
 * reloads the page at once.
 */
export function provideAppServiceWorker(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    provideAppInitializer(() => {
      const swUpdate = inject(SwUpdate);
      if (!swUpdate.isEnabled) {
        return;
      }
      const neuLaden = inject(SEITE_NEU_LADEN);
      swUpdate.unrecoverable
        .pipe(takeUntilDestroyed(inject(DestroyRef)))
        .subscribe(() => neuLaden());
    }),
  ]);
}
