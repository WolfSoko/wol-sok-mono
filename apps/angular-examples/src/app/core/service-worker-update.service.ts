import { inject, Injectable } from '@angular/core';

import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import {
  SwUpdate,
  VersionEvent,
  VersionReadyEvent,
} from '@angular/service-worker';
import {
  concat,
  exhaustMap,
  filter,
  from,
  interval,
  map,
  Observable,
  of,
} from 'rxjs';
import { environment } from '../../environments/environment';

export type CHECK_FOR_UPDATE_STATE =
  | 'CHECKING_FOR_UPDATES'
  | 'NEW_VERSION_AVAILABLE'
  | 'NO_NEW_VERSION_AVAILABLE';

@Injectable({ providedIn: 'root' })
export class ServiceWorkerUpdateService {
  private readonly swUpdate = inject(SwUpdate);
  private readonly snackbar = inject(MatSnackBar);
  private readonly router = inject(Router);

  versionReady$: Observable<boolean>;

  constructor() {
    this.versionReady$ = this.swUpdate.versionUpdates.pipe(
      filter<VersionEvent, VersionReadyEvent>(
        ServiceWorkerUpdateService.isVersionReadyEvent
      ),
      map(() => true)
    );
  }

  private static isVersionReadyEvent(
    event: VersionEvent
  ): event is VersionReadyEvent {
    return event.type === 'VERSION_READY';
  }

  showSnackOnUpdateAvailable() {
    if (!environment.production) {
      return;
    }

    this.versionReady$.subscribe(() => {
      const snack = this.snackbar.open('Update Available', 'Reload', {
        duration: 6000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
      });
      snack.onAction().subscribe(() => {
        this.activateUpdate().then(() => snack.dismiss());
      });
    });
  }

  checkForUpdatesRegularly(): Observable<CHECK_FOR_UPDATE_STATE> {
    return interval(environment.serviceWorkerCheckInterval).pipe(
      exhaustMap(() =>
        concat(
          of('CHECKING_FOR_UPDATES' as const),
          from(
            this.swUpdate
              .checkForUpdate()
              .then((versionAvailable) =>
                versionAvailable
                  ? 'NEW_VERSION_AVAILABLE'
                  : 'NO_NEW_VERSION_AVAILABLE'
              )
          )
        )
      )
    );
  }

  async activateUpdate() {
    await this.swUpdate.activateUpdate();
    await this.router.navigate(['/home']);
    return document.location.reload();
  }
}
