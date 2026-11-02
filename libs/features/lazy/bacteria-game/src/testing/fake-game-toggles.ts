import {
  type EnvironmentProviders,
  inject,
  makeEnvironmentProviders,
  provideEnvironmentInitializer,
} from '@angular/core';
import { isObservable, type Observable, of } from 'rxjs';
import { FeatureTogglesService } from '../lib/feature-toggles.service';
import type { FeatureToggles } from '../lib/state/feature-toggles';
import { GameToggles } from '../lib/storage/game-toggles';

/**
 * The owner's feature toggles for a spec: `toggles` as the port says them -
 * a fixed set, or a subject the spec drives - with
 * `FeatureTogglesService` reading them from the start, as it does once the
 * game rendered.
 */
export function provideGameToggles(
  toggles: Partial<FeatureToggles> | Observable<Partial<FeatureToggles>> = {}
): EnvironmentProviders {
  const set = isObservable(toggles) ? toggles : of(toggles);
  return makeEnvironmentProviders([
    {
      provide: GameToggles,
      useValue: { watch: () => set } satisfies GameToggles,
    },
    provideEnvironmentInitializer(() => inject(FeatureTogglesService).start()),
  ]);
}
