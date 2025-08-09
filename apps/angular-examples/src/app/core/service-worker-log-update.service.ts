import { Injectable, inject } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ServiceWorkerLogUpdateService {
  private updates = inject(SwUpdate);

  startLogging() {
    if (!environment.production) {
      console.log('ServiceWorker not used. Because in dev mode!');
      return;
    }
    if (!this.updates.isEnabled) {
      console.log('ServiceWorker not enabled');
      return;
    }

    this.updates.versionUpdates.subscribe((event) => {
      console.log('Service Worker, version update event:', event);
    });
    this.updates.unrecoverable.subscribe((event) => {
      console.warn('Service worker:', event);
    });
  }
}
