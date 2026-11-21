import { inject, Injectable, signal } from '@angular/core';
import { filter } from 'rxjs/operators';
import { OnlineMatchService } from './online-match.service';

/** The wins of an online room: the host's (left) first, the guest's second. */
export type Tally = readonly [host: number, guest: number];

export const EMPTY_TALLY: Tally = [0, 0];

/** The tally after a match `winner` won - a draw (null) counts for nobody. */
export function countResult(tally: Tally, winner: 0 | 1 | null): Tally {
  if (winner === null) {
    return tally;
  }
  return winner === 0 ? [tally[0] + 1, tally[1]] : [tally[0], tally[1] + 1];
}

/**
 * Counts the wins of the matches two devices played over one connection,
 * for the room both players see. A new connection starts at nought; the
 * end of one keeps its count, so its last result still shows it.
 */
@Injectable({ providedIn: 'root' })
export class RoomTally {
  private readonly state = signal<Tally>(EMPTY_TALLY);

  public readonly tally = this.state.asReadonly();

  public constructor() {
    inject(OnlineMatchService)
      .events$.pipe(filter((event) => event.type === 'connected'))
      .subscribe(() => this.state.set(EMPTY_TALLY));
  }

  /** Counts a match of the room for the seat that won it. */
  public count(winner: 0 | 1 | null): void {
    this.state.update((tally) => countResult(tally, winner));
  }
}
