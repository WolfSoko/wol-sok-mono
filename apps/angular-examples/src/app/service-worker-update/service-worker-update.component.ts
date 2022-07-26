import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { UntilDestroy } from '@ngneat/until-destroy';
import { environment } from '../../environments/environment';
import { ServiceWorkerLogUpdateService } from '../core/service-worker-log-update.service';
import { ServiceWorkerUpdateService } from '../core/service-worker-update.service';

@UntilDestroy()
@Component({
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule],
  selector: 'app-service-worker-update',
  templateUrl: './service-worker-update.component.html',
  styleUrls: ['./service-worker-update.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceWorkerUpdateComponent {
  isLoading = false;
  updatesAvailable = false;

  constructor(
    updateLogger: ServiceWorkerLogUpdateService,
    private updateService: ServiceWorkerUpdateService
  ) {
    if (!environment.production) {
      return;
    }
    updateLogger.startLogging();
    updateService.showSnackOnUpdateAvailable();

    updateService.checkForUpdatesRegularly().subscribe({
      next: (state) => {
        switch (state) {
          case 'CHECKING_FOR_UPDATES':
            this.isLoading = true;
            break;
          case 'NEW_VERSION_AVAILABLE':
          case 'NO_NEW_VERSION_AVAILABLE':
            this.isLoading = false;
            break;
        }
      },
      error: (error) => {
        this.isLoading = false;
        console.error(error);
      },
    });
  }

  activateUpdate() {
    this.updateService.activateUpdate();
  }
}
