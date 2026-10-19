import { Injectable, inject } from '@angular/core';
import { applyTransaction } from '@datorama/akita';
import { MeasureFps } from '@wolsok/utils-measure-fps';
import {
  animationFrames,
  defer,
  filter,
  map,
  Observable,
  Subject,
  Subscription,
  switchMap,
  takeUntil,
} from 'rxjs';
import { scaleOf } from './arena-size';
import { FramePacer } from './frame-pacer';
import { BotDifficulty } from './bot-controller';
import {
  getColonyColor,
  pickColor,
  sameColors,
  toPlayerColor,
  validColorPair,
} from './colony-colors';
import { GameStateQuery } from './game-state.query';
import {
  GameMode,
  GameState,
  GameStateState,
  GameStateStore,
  isMatchOn,
} from './game.states';
import {
  getLevel,
  levelBalance,
  levelCrosshairSpeed,
  levelMap,
} from './levels';
import { colonyCapacity } from './game-balance';
import { MatchEarnings } from './earnings';
import {
  addSeriesMatch,
  HeadStart,
  newSeries,
  Series,
  SeriesLength,
  seriesWinner,
  startScales,
} from './rivalry';
import { matchRecord } from './medallions';
import { Player } from './player.model';

import { PlayerQuery } from './player.query';
import { PlayerService } from './player.service';
import { ProgressService } from '../progress.service';

/** The longest step a frame may take the war, in milliseconds. */
const MAX_FRAME_MS = 100;

/** How a match ended. `winner` is null when both colonies died together. */
interface MatchOutcome {
  winner: Player | null;
}

@Injectable({ providedIn: 'root' })
export class GameStateService {
  private gameStateStore = inject(GameStateStore);
  private gameStateQuery = inject(GameStateQuery);
  private playerQuery = inject(PlayerQuery);
  private playerService = inject(PlayerService);
  private progress = inject(ProgressService);

  /**
   * The milliseconds since the last frame, on the display frames the game
   * runs on - see {@link FramePacer}.
   */
  private gameLoop$: Observable<number> = defer(() => {
    const pacer = new FramePacer();
    return animationFrames().pipe(
      map(({ timestamp }) => pacer.frame(timestamp)),
      filter((elapsed) => elapsed != null),
      // After a hidden tab or a stall the war goes on where it stood rather
      // than leap ahead - and the match clock, which judges the medallions,
      // counts only the time that was played.
      map((elapsed) => Math.min(elapsed, MAX_FRAME_MS))
    );
  });
  private readonly frames = new Subject<number>();
  private subscriptions?: Subscription;
  private measureFps = new MeasureFps();

  /**
   * Emits the milliseconds since the last frame on every frame of a running
   * match - inside the animation frame, after the store has the new time,
   * so the war can be advanced and painted right there.
   */
  public readonly frames$: Observable<number> = this.frames.asObservable();

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
      earnings: null,
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
          this.frames.next(timeDelta);
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
        .subscribe((outcome) => this.endMatch(outcome))
    );
  }

  /**
   * Ends the match with its outcome and, against the computer, the medallion
   * it earned - judged and remembered right here, so the result and the
   * award reach the store together.
   */
  private endMatch(outcome: MatchOutcome): void {
    const { series } = this.gameStateQuery.getValue();
    const earnings = this.recordMatch(outcome.winner);
    applyTransaction(() => {
      this.gameStateStore.update({ currentState: GameState.END });
      this.gameStateStore.update({
        winner: outcome.winner,
        matchEnded: true,
        earnings,
        series:
          series === null
            ? null
            : addSeriesMatch(series, winnerSeat(outcome.winner)),
      });
    });
  }

  /**
   * Remembers a match that has ended - against the computer its medallion
   * and numbers, between two players that it was played - and returns what
   * it earned. Null for a match against the computer without a human in it.
   */
  private recordMatch(winner: Player | null): MatchEarnings | null {
    const { mode, levelId, difficulty, timePassed, width, colors } =
      this.gameStateQuery.getValue();
    switch (mode) {
      case 'two-players': {
        const seat = winnerSeat(winner);
        return this.progress.recordCouchMatch(
          seat === null ? null : colors[seat]
        );
      }
      case 'vs-computer': {
        const record = matchRecord(this.playerQuery.getAll(), {
          levelId,
          difficulty,
          // Whole seconds, as the match clock shows them.
          durationSec: Math.floor(timePassed / 1000),
          winner,
          // The cap the simulation holds each of the two colonies to.
          capacity: colonyCapacity(
            levelBalance(getLevel(levelId), scaleOf(width)),
            2
          ),
        });
        return record === null ? null : this.progress.recordMatch(record);
      }
    }
  }

  /**
   * Spawns both colonies with the map and the balance of the current level.
   *
   * In `vs-computer` mode the second crosshair belongs to the bot, and the
   * names change with it so the scoreboard reads "You" and "Computer".
   * Between two players each one is called by their colour.
   */
  private initPlayers() {
    const { width, height, levelId, mode, difficulty, colors, headStart } =
      this.gameStateQuery.getValue();
    const level = getLevel(levelId);
    const scale = scaleOf(width);
    const versusComputer = mode === 'vs-computer';
    const [left, right] = colors.map(getColonyColor);
    const [leftScale, rightScale] = versusComputer
      ? [1, 1]
      : startScales(headStart);
    this.playerService.init(
      [
        {
          x: width / 4,
          y: height / 2,
          color: toPlayerColor(left),
          name: versusComputer ? 'You' : left.name,
          isBot: false,
          startScale: leftScale,
        },
        {
          x: (width / 4) * 3,
          y: height / 2,
          color: toPlayerColor(right),
          name: versusComputer ? 'Computer' : right.name,
          isBot: versusComputer,
          startScale: rightScale,
        },
      ],
      {
        balance: levelBalance(level, scale),
        map: levelMap(level),
        crosshairSpeed: levelCrosshairSpeed(level, scale),
        difficulty,
        arena: { width, height },
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
   * True while nobody is playing - the only time the colonies may be spawned
   * again. A paused match is still a match and keeps its colonies.
   */
  private isIdle(): boolean {
    return !isMatchOn(this.gameStateQuery.getValue().currentState);
  }

  /**
   * Changes how the next match is set up - level, opponent, difficulty or
   * colours.
   *
   * A match keeps the rules it started with: the colonies are only spawned
   * again - with the new map, balance and opponent - while nobody is playing.
   */
  private updateSetup(
    setup: Partial<
      Pick<
        GameStateState,
        | 'levelId'
        | 'mode'
        | 'difficulty'
        | 'colors'
        | 'seriesLength'
        | 'headStart'
        | 'series'
      >
    >
  ): void {
    this.gameStateStore.update(setup);
    if (this.isIdle()) {
      this.initPlayers();
    }
  }

  /** Picks the level the next match is played on. */
  public setLevel(levelId: string): void {
    this.updateSetup({ levelId: getLevel(levelId).id });
  }

  /** Switches between two humans and human versus computer. */
  public setMode(mode: GameMode): void {
    this.updateSetup({
      mode,
      ...this.seriesEndsUnless(mode === this.gameStateQuery.getValue().mode),
    });
  }

  /** Picks how many matches a series between two players is the best of. */
  public setSeriesLength(seriesLength: SeriesLength): void {
    this.updateSetup({
      seriesLength,
      ...this.seriesEndsUnless(
        seriesLength === this.gameStateQuery.getValue().seriesLength
      ),
    });
  }

  /** Gives one of two players a head start - or neither. */
  public setHeadStart(headStart: HeadStart): void {
    this.updateSetup({
      headStart,
      ...this.seriesEndsUnless(
        headStart === this.gameStateQuery.getValue().headStart
      ),
    });
  }

  /** A series ends when its setup changes - nothing, when it stays. */
  private seriesEndsUnless(unchanged: boolean): { series?: null } {
    return unchanged ? {} : { series: null };
  }

  /** Ends the series under way - the next match starts a new one. */
  public endSeries(): void {
    this.gameStateStore.update({ series: null });
  }

  /** Picks how hard the computer plays. */
  public setDifficulty(difficulty: BotDifficulty): void {
    this.updateSetup({ difficulty });
  }

  /**
   * Gives a seat's colony another colour - 0 is the left seat, 1 the right
   * one. Picking the other seat's colour swaps the two.
   */
  public setColor(seat: 0 | 1, colorId: string): void {
    const { colors } = this.gameStateQuery.getValue();
    const picked = pickColor(colors, seat, getColonyColor(colorId).id);
    this.updateSetup({
      colors: picked,
      ...this.seriesEndsUnless(sameColors(picked, colors)),
    });
  }

  /**
   * Gives both colonies their colours at once. A pair with an unknown colour
   * or the same colour twice is ignored.
   */
  public setColors(colors: readonly [string, string]): void {
    const valid = validColorPair(colors);
    if (valid != null) {
      this.updateSetup({
        colors: valid,
        ...this.seriesEndsUnless(
          sameColors(valid, this.gameStateQuery.getValue().colors)
        ),
      });
    }
  }

  /** Fires the boost of a player - the touch equivalent of Space / Enter. */
  public boost(playerId: number): void {
    if (this.gameStateQuery.getValue().currentState !== GameState.RUNNING) {
      return;
    }
    this.playerService.boost(playerId);
  }

  start() {
    this.initPlayers();
    this.gameStateStore.update((state) => ({
      currentState: GameState.RUNNING,
      series: nextSeries(state),
      // Restart from the pause menu starts without a reset in between.
      timePassed: 0,
      winner: null,
      matchEnded: false,
      earnings: null,
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
      earnings: null,
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

/**
 * The series the next match belongs to: the one under way between two
 * players, a new one once it has been decided - none for single matches or
 * against the computer.
 */
function nextSeries(state: GameStateState): Series | null {
  if (state.mode !== 'two-players' || state.seriesLength === 1) {
    return null;
  }
  return state.series !== null && seriesWinner(state.series) === null
    ? state.series
    : newSeries(state.seriesLength);
}

/** The seat of the player who won - 0 left, 1 right - null for a draw. */
function winnerSeat(winner: Player | null): 0 | 1 | null {
  return winner === null ? null : winner.id === 0 ? 0 : 1;
}
