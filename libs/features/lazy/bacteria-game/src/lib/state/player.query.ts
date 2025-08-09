import { Injectable, inject } from '@angular/core';
import { QueryEntity } from '@datorama/akita';
import { Player } from './player.model';
import { PlayerState, PlayerStore } from './player.store';

@Injectable({
  providedIn: 'root',
})
export class PlayerQuery extends QueryEntity<PlayerState, Player> {
  protected override store: PlayerStore;

  constructor() {
    const store = inject(PlayerStore);

    super(store);

    this.store = store;
  }
}
