import { patchState, signalStore, withMethods } from '@ngrx/signals';
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
  withMethods((store) => ({
    /** Replaces every player - a new match. */
    setPlayers(players: readonly Player[]): void {
      patchState(store, setAllEntities(players.slice()));
    },
    /** Puts the players in, replacing the ones with the same id. */
    upsertPlayers(players: readonly Player[]): void {
      patchState(store, upsertEntities(players.slice()));
    },
  }))
);
export type PlayerStore = InstanceType<typeof PlayerStore>;
