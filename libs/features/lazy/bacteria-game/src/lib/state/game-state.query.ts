import { Injectable, inject } from '@angular/core';
import { Query } from '@datorama/akita';
import { distinctUntilChanged, filter, map, Observable } from 'rxjs';
import { BotDifficulty } from './bot-controller';
import {
  GameMode,
  GameState,
  GameStateState,
  GameStateStore,
  isMatchOn,
} from './game.states';
import { sameColors } from './colony-colors';
import { getLevel, Level } from './levels';
import { MedalAward } from './medallions';

@Injectable({ providedIn: 'root' })
export class GameStateQuery extends Query<GameStateState> {
  protected override store: GameStateStore;

  constructor() {
    const store = inject(GameStateStore);

    super(store);

    this.store = store;
  }

  selectCurrentGameState(gameStateFilter?: GameState): Observable<GameState> {
    return this.select((store) => store.currentState).pipe(
      distinctUntilChanged(),
      filter((state) =>
        gameStateFilter == null ? true : state === gameStateFilter
      )
    );
  }

  selectFps(): Observable<number> {
    return this.select('fps');
  }

  /** The level that is selected, resolved from the stored id. */
  selectLevel(): Observable<Level> {
    return this.select((store) => store.levelId).pipe(
      distinctUntilChanged(),
      map((levelId) => getLevel(levelId))
    );
  }

  /** Who steers the second crosshair. */
  public selectMode(): Observable<GameMode> {
    return this.select((store) => store.mode).pipe(distinctUntilChanged());
  }

  /** The colour ids of the left and the right colony. */
  public selectColors(): Observable<[string, string]> {
    return this.select((store) => store.colors).pipe(
      distinctUntilChanged<[string, string]>(sameColors)
    );
  }

  /** How hard the computer plays. */
  public selectDifficulty(): Observable<BotDifficulty> {
    return this.select((store) => store.difficulty).pipe(
      distinctUntilChanged()
    );
  }

  selectWinnerId() {
    return this.select((store) => store.winner);
  }

  /** What the match that just ended earned, null without a medallion run. */
  public selectAward(): Observable<MedalAward | null> {
    return this.select((store) => store.award);
  }

  /** Emits true while a match is on, paused or not. */
  selectIsMatchOn(): Observable<boolean> {
    return this.select((store) => isMatchOn(store.currentState)).pipe(
      distinctUntilChanged()
    );
  }

  /** Emits true while the match is paused. */
  selectIsPaused(): Observable<boolean> {
    return this.select((store) => store.currentState === GameState.PAUSED).pipe(
      distinctUntilChanged()
    );
  }

  /** Emits true once a match is over, a draw included. */
  selectMatchEnded(): Observable<boolean> {
    return this.select((store) => store.matchEnded).pipe(
      distinctUntilChanged()
    );
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
