import { Injectable, inject } from '@angular/core';
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
import {
  getLevel,
  levelBalance,
  levelCrosshairSpeed,
  levelMap,
} from './levels';
import { Player } from './player.model';

/** How a match ended. `winner` is null when both colonies died together. */
interface MatchOutcome {
  winner: Player | null;
}
import { PlayerQuery } from './player.query';
import { PlayerService } from './player.service';

const FPS = 60;

@Injectable({ providedIn: 'root' })
export class GameStateService {
  private gameStateStore = inject(GameStateStore);
  private gameStateQuery = inject(GameStateQuery);
  private playerQuery = inject(PlayerQuery);
  private playerService = inject(PlayerService);

  private gameLoop$: Observable<number>;
  private subscriptions?: Subscription;
  private measureFps = new MeasureFps();

  constructor() {
    this.gameLoop$ = interval(1000 / FPS, animationFrameScheduler).pipe(
      timestamp(),
      pairwise(),
      map(([value1, value2]) => value2.timestamp - value1.timestamp)
    );
  }

  /**
   * Decides whether the match is over.
   *
   * Returns `null` while it is still running, otherwise the outcome. Both
   * colonies can wipe each other out in the same step, which is a draw and
   * still has to end the match - hence the outcome wrapper instead of a bare
   * winner, which cannot tell "draw" from "not finished".
   */
  private static determineOutcome(players: Player[]): MatchOutcome | null {
    if (players.length < 2) {
      return null;
    }
    const survivors = players.filter((player) => player.bacteriaCount > 0);
    if (survivors.length === 1) {
      return { winner: survivors[0] };
    }
    // Only a match that saw losses can be a draw - at kick off nobody has
    // bacteria yet either, and that is not an outcome.
    const fought = players.some((player) => player.lost > 0);
    return survivors.length === 0 && fought ? { winner: null } : null;
  }

  init(width: number, height: number) {
    this.gameStateStore.update({
      width,
      height,
      winner: null,
      matchEnded: false,
    });
    // subscribe update time passed when game running
    const running$ = this.gameStateQuery.selectCurrentGameState(
      GameState.RUNNING
    );
    const notRunning$ = this.gameStateQuery
      .selectCurrentGameState()
      .pipe(filter((value) => value !== GameState.RUNNING));

    this.subscriptions = running$
      .pipe(switchMap(() => this.gameLoop$.pipe(takeUntil(notRunning$))))
      .subscribe({
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

    this.subscriptions.add(
      this.measureFps.fps$.subscribe((fps) =>
        this.gameStateStore.update({ fps })
      )
    );

    // subscribe determine Winner
    this.subscriptions.add(
      running$
        .pipe(
          switchMap(() =>
            this.playerQuery
              .selectAll()
              .pipe(
                takeUntil(
                  this.gameStateQuery
                    .selectCurrentGameState()
                    .pipe(filter((value) => value !== GameState.RUNNING))
                )
              )
          ),
          map((players) => GameStateService.determineOutcome(players)),
          filter((outcome) => outcome != null)
        )
        .subscribe((outcome) =>
          applyTransaction(() => {
            this.gameStateStore.update({ currentState: GameState.END });
            this.gameStateStore.update({
              winner: outcome.winner,
              matchEnded: true,
            });
          })
        )
    );
  }

  /** Spawns both colonies with the map and the balance of the current level. */
  private initPlayers() {
    const { width, height, levelId } = this.gameStateQuery.getValue();
    const level = getLevel(levelId);
    this.playerService.init(
      [
        { x: width / 4, y: height / 2, color: [255, 100, 20, 255] },
        {
          x: (width / 4) * 3,
          y: height / 2,
          color: [0, 100, 230, 255],
        },
      ],
      {
        balance: levelBalance(level),
        map: levelMap(level),
        crosshairSpeed: levelCrosshairSpeed(level),
      }
    );
  }

  /**
   * Tells the store how big the arena is.
   *
   * The colonies are spawned again right away, so the start screen shows both
   * blobs where the next match will actually begin - before that the store
   * still has its default size and would put them outside the canvas.
   */
  setArenaSize(width: number, height: number): void {
    this.gameStateStore.update({ width, height });
    this.initPlayers();
  }

  /**
   * Picks the level the next match is played on.
   *
   * A running match keeps the rules it started with: the colonies are only
   * spawned again - with the new map and balance - while nobody is playing.
   */
  setLevel(levelId: string): void {
    this.gameStateStore.update({ levelId: getLevel(levelId).id });
    if (this.gameStateQuery.getValue().currentState !== GameState.RUNNING) {
      this.initPlayers();
    }
  }

  start() {
    this.initPlayers();
    this.gameStateStore.update(() => ({
      currentState: GameState.RUNNING,
      winner: null,
      matchEnded: false,
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
      winner: null,
      matchEnded: false,
    }));
  }

  /** Switches between RUNNING and PAUSED - bound to the P key and the button. */
  togglePause(): void {
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
      keysPressed: [
        ...state.keysPressed.filter((keys) => keyToAdd !== keys),
        keyToAdd,
      ],
    }));
  }

  removeKeyPress(key: string): void {
    this.gameStateStore.update((state) => ({
      keysPressed: state.keysPressed.filter((keys) => key !== keys),
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
