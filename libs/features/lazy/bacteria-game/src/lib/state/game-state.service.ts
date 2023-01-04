import { Injectable } from '@angular/core';
import { applyTransaction } from '@datorama/akita';
import { MeasureFps } from '@wolsok/utils-measure-fps';
import {
  animationFrameScheduler,
  filter,
  interval,
  map,
  Observable,
  pairwise,
  Subscription,
  switchMap,
  takeUntil,
  timestamp,
} from 'rxjs';
import { GameStateQuery } from './game-state.query';
import { GameState, GameStateStore } from './game.states';
import { Player } from './player.model';
import { PlayerQuery } from './player.query';
import { PlayerService } from './player.service';

const FPS = 60;

@Injectable({ providedIn: 'root' })
export class GameStateService {
  private gameLoop$: Observable<number>;
  private subscriptions?: Subscription;
  private measureFps = new MeasureFps();

  constructor(
    private gameStateStore: GameStateStore,
    private gameStateQuery: GameStateQuery,
    private playerQuery: PlayerQuery,
    private playerService: PlayerService
  ) {
    this.gameLoop$ = interval(1000 / FPS, animationFrameScheduler).pipe(
      timestamp(),
      pairwise(),
      map(([value1, value2]) => value2.timestamp - value1.timestamp)
    );
  }

  private static determineWinner(players: Player[]): Player | null {
    const hasBacteriasPlayers = players.filter((value) => value.bacterias.length > 0);
    if (hasBacteriasPlayers.length === 1) {
      return players[0];
    }
    return null;
  }

  init(width: number, height: number) {
    this.gameStateStore.update({ width, height, winner: null });
    // subscribe update time passed when game running
    const running$ = this.gameStateQuery.selectCurrentGameState(GameState.RUNNING);
    const notRunning$ = this.gameStateQuery
      .selectCurrentGameState()
      .pipe(filter((value) => value !== GameState.RUNNING));

    this.subscriptions = running$.pipe(switchMap(() => this.gameLoop$.pipe(takeUntil(notRunning$)))).subscribe({
      next: (timeDelta) => {
        this.measureFps.signalFrameReady();
        this.gameStateStore.update((state) => ({
          timePassed: state.timePassed + timeDelta,
          timeDelta,
        }));
      },
      error: (error) => {
        console.error('error in gameLoop', error);
      },
    });

    this.subscriptions.add(this.measureFps.fps$.subscribe((fps) => this.gameStateStore.update({ fps })));

    // subscribe determine Winner
    this.subscriptions.add(
      running$
        .pipe(
          switchMap(() =>
            this.playerQuery
              .selectAll()
              .pipe(
                takeUntil(
                  this.gameStateQuery.selectCurrentGameState().pipe(filter((value) => value !== GameState.RUNNING))
                )
              )
          ),
          map((players) => GameStateService.determineWinner(players)),
          filter((winner) => winner != null)
        )
        .subscribe((winner) =>
          applyTransaction(() => {
            this.gameStateStore.update({ currentState: GameState.END });
            this.gameStateStore.update({ winner: winner });
          })
        )
    );
  }

  private initPlayers() {
    const { width, height } = this.gameStateQuery.getValue();
    this.playerService.init([
      { x: width / 4, y: height / 2, color: [255, 100, 20, 255] },
      {
        x: (width / 4) * 3,
        y: height / 2,
        color: [0, 100, 230, 255],
      },
    ]);
  }

  start() {
    this.initPlayers();
    this.gameStateStore.update(() => ({
      currentState: GameState.RUNNING,
    }));
  }

  reset() {
    this.gameStateStore.update(() => ({
      currentState: GameState.END,
      timePassed: 0,
    }));
    this.initPlayers();
    this.gameStateStore.update(() => ({
      currentState: GameState.START,
      timePassed: 0,
      timeDelta: 1,
    }));
  }

  private togglePause(): void {
    this.gameStateStore.update((state) => {
      if (state.currentState === GameState.RUNNING) {
        return { currentState: GameState.PAUSED };
      }
      if (state.currentState === GameState.PAUSED) {
        return { currentState: GameState.RUNNING };
      }
      return state;
    });
  }

  addKeyPress(keyToAdd: string): void {
    if (keyToAdd.toLowerCase() === 'p') {
      this.togglePause();
      return;
    }
    this.gameStateStore.update((state) => ({
      keysPressed: [...state.keysPressed.filter((keys) => keyToAdd !== keys), keyToAdd],
    }));
  }

  removeKeyPress(key: string): void {
    this.gameStateStore.update((state) => ({
      keysPressed: [...state.keysPressed.filter((keys) => key !== keys)],
    }));
  }

  cleanup(): void {
    this.pause();
    this.gameStateStore.update({ keysPressed: [], fps: 0 });
    this.subscriptions?.unsubscribe();
  }

  pause() {
    this.gameStateStore.update({ currentState: GameState.PAUSED });
  }
}
