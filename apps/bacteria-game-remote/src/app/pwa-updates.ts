import {
  ApplicationRef,
  DestroyRef,
  DOCUMENT,
  EnvironmentProviders,
  inject,
  InjectionToken,
  provideAppInitializer,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SwUpdate } from '@angular/service-worker';
import { first, interval, switchMap } from 'rxjs';

/** An installed game can stay open for days, so look for releases hourly. */
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/** Reloads the page, so the service worker serves the latest version. */
export const RELOAD_PAGE = new InjectionToken<() => void>('RELOAD_PAGE', {
  providedIn: 'root',
  factory: () => {
    const document = inject(DOCUMENT);
    return () => document.location.reload();
  },
});

/**
 * Offers a reload once the service worker has downloaded a new release.
 *
 * The game never reloads on its own, as that would end a running match: the
 * player picks the moment. Only a broken cache, which the service worker
 * cannot serve from any more, forces a reload.
 */
export function providePwaUpdates(): EnvironmentProviders {
  return provideAppInitializer(() => {
    const swUpdate = inject(SwUpdate);
    if (!swUpdate.isEnabled) {
      return;
    }
    const snackBar = inject(MatSnackBar);
    const reloadPage = inject(RELOAD_PAGE);
    const destroyRef = inject(DestroyRef);

    swUpdate.versionUpdates
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((event) => {
        if (event.type === 'VERSION_READY') {
          snackBar
            .open('A new version of the game is ready', 'Reload')
            .onAction()
            .subscribe(reloadPage);
        } else if (event.type === 'VERSION_INSTALLATION_FAILED') {
          console.error('Could not install the new version', event.error);
        }
      });

    swUpdate.unrecoverable
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(reloadPage);

    inject(ApplicationRef)
      .isStable.pipe(
        first((isStable) => isStable),
        switchMap(() => interval(UPDATE_CHECK_INTERVAL_MS)),
        takeUntilDestroyed(destroyRef)
      )
      .subscribe(() =>
        swUpdate
          .checkForUpdate()
          .catch((error) => console.error('Update check failed', error))
      );
  });
}
