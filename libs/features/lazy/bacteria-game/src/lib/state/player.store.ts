import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import {
  setAllEntities,
  upsertEntities,
  withEntities,
} from '@ngrx/signals/entities';
import { Player } from './player.model';

/**
 * The players of the match on the board, as the UI sees them - mirrored from
 * the match engine by `PlayerService`, which alone writes here.
 */
export const PlayerStore = signalStore(
  { providedIn: 'root' },
  withEntities<Player>(),
  // The neutral colonies' bacteria, all together - null on a level without.
  withState<{ neutralCount: number | null }>({ neutralCount: null }),
  withMethods((store) => ({
    /** Replaces every player - a new match. */
    setPlayers(players: readonly Player[]): void {
      patchState(store, setAllEntities(players.slice()));
    },
    /** The neutral colonies' bacteria now, null on a level without. */
    setNeutralCount(neutralCount: number | null): void {
      patchState(store, { neutralCount });
    },
    /** Puts the players in, replacing the ones with the same id. */
    upsertPlayers(players: readonly Player[]): void {
      patchState(store, upsertEntities(players.slice()));
    },
  }))
);
export type PlayerStore = InstanceType<typeof PlayerStore>;
