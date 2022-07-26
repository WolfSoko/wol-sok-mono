import { Injectable } from '@angular/core';

import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import {
  SwUpdate,
  VersionEvent,
  VersionReadyEvent,
} from '@angular/service-worker';
import { filter } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ServiceWorkerUpdateService {
  constructor(
    private swUpdate: SwUpdate,
    private snackbar: MatSnackBar,
    private router: Router
  ) {}

  private static isNewVersionReady(
    event: VersionEvent
  ): event is VersionReadyEvent {
    return event.type === 'VERSION_READY';
  }

  showSnackOnUpdateAvailable() {
    if (!environment.production) {
      return;
    }
    this.swUpdate.versionUpdates
      .pipe(
        filter((event) => ServiceWorkerUpdateService.isNewVersionReady(event))
      )
      .subscribe(() => {
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


  activateUpdate() {
    return this.swUpdate
      .activateUpdate()
      .then(() => this.router.navigate(['/home']))
      .then(() => document.location.reload());
  }
}
