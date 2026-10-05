import { Injectable } from '@angular/core';
import { Store, StoreConfig } from '@datorama/akita';
import { LEVELS } from './levels';
import { Player } from './player.model';

export enum GameState {
  RUNNING,
  PAUSED,
  END,
  START,
}

export interface GameStateState {
  currentState: GameState;
  timePassed: number;
  timeDelta: number;
  fps: number;
  width: number;
  height: number;
  winner: Player | null;
  /** True once a match is over - also for a draw, where `winner` stays null. */
  matchEnded: boolean;
  keysPressed: string[];
  /** Id of the level that is selected - decides the map and the balance. */
  levelId: string;
}

export function createInitialState(): GameStateState {
  return {
    currentState: GameState.START,
    timePassed: 1,
    timeDelta: 1,
    fps: 0,
    width: 480,
    height: 320,
    winner: null,
    matchEnded: false,
    keysPressed: [],
    levelId: LEVELS[0].id,
  };
}

@Injectable({ providedIn: 'root' })
@StoreConfig({ name: 'game-state' })
export class GameStateStore extends Store<GameStateState> {
  constructor() {
    super(createInitialState());
  }
}
