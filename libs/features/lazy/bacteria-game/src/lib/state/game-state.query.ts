import { Injectable } from '@angular/core';
import { Query } from '@datorama/akita';
import { distinctUntilChanged, filter, map, Observable } from 'rxjs';
import { GameState, GameStateState, GameStateStore } from './game.states';

@Injectable({ providedIn: 'root' })
export class GameStateQuery extends Query<GameStateState> {
  constructor(protected override store: GameStateStore) {
    super(store);
  }

  selectCurrentGameState(gameStateFilter?: GameState): Observable<GameState> {
    return this.select((store) => store.currentState).pipe(
      distinctUntilChanged(),
      filter((state) =>
        gameStateFilter == null ? true : state === gameStateFilter
      )
    );
  }

  selectTimeDelta() {
    return this.select((store) => store.timeDelta);
  }

  selectFps(): Observable<number> {
    return this.select('fps');
  }

  selectWinnerId() {
    return this.select((store) => store.winner);
  }

  selectKeysPressed(): Observable<{
    keysPressed: string[];
    deltaTimeSec: number;
  }> {
    return this.select().pipe(
      filter((value) => value.currentState === GameState.RUNNING),
      map((store1) => ({
        keysPressed: store1.keysPressed,
        deltaTimeSec: store1.timeDelta / 1000.0,
      }))
    );
  }
}
