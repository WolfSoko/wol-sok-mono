import { Injectable } from '@angular/core';
import { QueryEntity } from '@datorama/akita';
import { Player } from './player.model';
import { PlayerState, PlayerStore } from './player.store';

@Injectable({
  providedIn: 'root',
})
export class PlayerQuery extends QueryEntity<PlayerState, Player> {
  constructor(protected override store: PlayerStore) {
    super(store);
  }
}
