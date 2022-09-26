import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { catchError, map, Observable, of, startWith } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ServiceWorkerLogUpdateService } from '../../../core/service-worker-log-update.service';
import {
  CHECK_FOR_UPDATE_STATE,
  ServiceWorkerUpdateService,
} from '../../../core/service-worker-update.service';

type ViewModel = { isLoading: boolean; updateAvailable: boolean };

const defaultVM: ViewModel = {
  isLoading: false,
  updateAvailable: false,
};

function createViewModel(vm: Partial<ViewModel> = {}): ViewModel {
  return { ...defaultVM, ...vm };
}

@Component({
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule, MatButtonModule],
  selector: 'app-service-worker-update',
  templateUrl: './service-worker-update.component.html',
  styleUrls: ['./service-worker-update.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceWorkerUpdateComponent {
  vm$: Observable<ViewModel> = of(createViewModel());

  constructor(
    updateLogger: ServiceWorkerLogUpdateService,
    private updateService: ServiceWorkerUpdateService
  ) {
    if (!environment.production) {
      return;
    }
    updateLogger.startLogging();
    updateService.showSnackOnUpdateAvailable();

    this.vm$ = this.updateService.checkForUpdatesRegularly().pipe(
      map((state) => this.mapToViewModel(state)),
      catchError((error) => {
        console.error(error);
        return of(createViewModel());
      }),
      startWith(createViewModel())
    );
  }

  private mapToViewModel(state: CHECK_FOR_UPDATE_STATE): ViewModel {
    switch (state) {
      case 'CHECKING_FOR_UPDATES':
        return createViewModel({ isLoading: true });
      case 'NEW_VERSION_AVAILABLE':
        return createViewModel({ updateAvailable: true });
      case 'NO_NEW_VERSION_AVAILABLE':
        return createViewModel();
    }
  }

  async activateUpdate(): Promise<void> {
    await this.updateService.activateUpdate();
  }
}
