import { Injectable } from '@angular/core';
import { Store, StoreConfig } from '@datorama/akita';
import { BotDifficulty } from './bot-controller';
import { LEVELS } from './levels';
import { Player } from './player.model';

/** Who steers the second crosshair. */
export type GameMode = 'two-players' | 'vs-computer';

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
  /** Two humans on one screen, or one human against the computer. */
  mode: GameMode;
  /** How hard the computer plays in `vs-computer` mode. */
  difficulty: BotDifficulty;
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
    mode: 'vs-computer',
    difficulty: 'normal',
  };
}

@Injectable({ providedIn: 'root' })
@StoreConfig({ name: 'game-state' })
export class GameStateStore extends Store<GameStateState> {
  constructor() {
    super(createInitialState());
  }
}
