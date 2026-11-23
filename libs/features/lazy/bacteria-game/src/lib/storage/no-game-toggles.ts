import { Observable, of } from 'rxjs';
import type { FeatureToggleStates } from '@wolsok/feat-shared-bacteria-engine/cloud';
import type { GameToggles } from './game-toggles';

/** No project, no owner to set anything: the defaults throughout. */
export class NoGameToggles implements GameToggles {
  public watch(): Observable<Partial<FeatureToggleStates>> {
    return of({});
  }
}
