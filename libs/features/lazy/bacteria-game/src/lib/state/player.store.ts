import { Injectable } from '@angular/core';
import { EntityState, EntityStore, StoreConfig } from '@datorama/akita';
import { Player } from './player.model';

export type PlayerState = EntityState<Player>;

@Injectable({ providedIn: 'root' })
@StoreConfig({ name: 'bacteria-player' })
export class PlayerStore extends EntityStore<PlayerState, Player> {
  constructor() {
    super();
  }
}
