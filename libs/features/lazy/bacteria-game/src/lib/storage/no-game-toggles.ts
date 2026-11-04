import { Observable, of } from 'rxjs';
import type { FeatureToggles } from '@wolsok/feat-shared-bacteria-engine';
import type { GameToggles } from './game-toggles';

/** No project, no owner to set anything: the defaults throughout. */
export class NoGameToggles implements GameToggles {
  public watch(): Observable<Partial<FeatureToggles>> {
    return of({});
  }
}
