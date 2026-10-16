import { isPlatformServer } from '@angular/common';
import {
  inject,
  Injectable,
  Injector,
  makeStateKey,
  PLATFORM_ID,
  Signal,
  TransferState,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { doc, Firestore } from '@angular/fire/firestore';
import { map, retry, tap, timer } from 'rxjs';
import {
  DEFAULT_FEATURES,
  FeatureToggles,
  toFeatureToggles,
} from '../../shared/app-config';
import { AppConfigPort } from '../ports/app-config.port';
import {
  pendingUntilFirstValue,
  SSR_DATA_TIMEOUT_MS,
} from './pending-until-first-value';
import { docSnapshots } from './snapshots';

/** The server's toggles, so hydration starts from what the server rendered. */
/** How long to wait before listening again after loading failed. */
const RETRY_DELAY_MS = 10_000;

const FEATURES_KEY = makeStateKey<FeatureToggles>('rap-features');

@Injectable()
export class AppConfigAdapter extends AppConfigPort {
  private readonly transferState = inject(TransferState);
  private readonly isServer: boolean = isPlatformServer(inject(PLATFORM_ID));

  public readonly features: Signal<FeatureToggles> = toSignal(
    docSnapshots(doc(inject(Firestore), 'appConfig', 'features')).pipe(
      map((snapshot) => toFeatureToggles(snapshot.data())),
      tap((features) => {
        if (this.isServer) {
          this.transferState.set(FEATURES_KEY, features);
        }
      }),
      pendingUntilFirstValue(inject(Injector), SSR_DATA_TIMEOUT_MS),
      // keep the last known toggles meanwhile: a broken config must not
      // break the app
      retry({
        delay: (error: unknown) => {
          console.error('Could not load the app config', error);
          return timer(RETRY_DELAY_MS);
        },
      })
    ),
    { initialValue: this.transferState.get(FEATURES_KEY, DEFAULT_FEATURES) }
  );
}
