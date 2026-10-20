import { Injectable, inject, untracked } from '@angular/core';
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
import { GameFrame, TICK_MS, TickClock, ticksToMs } from './fixed-tick';
import { BotDifficulty } from './bot-controller';
import {
  getColonyColor,
  pickColor,
  sameColors,
  validColorPair,
} from './colony-colors';
import {
  GameMode,
  GameState,
  GameStateState,
  GameStateStore,
  isMatchOn,
} from './game.states';
import { getLevel, levelBalance } from './levels';
import { colonyCapacity } from './game-balance';
import { MatchEarnings } from './earnings';
import {
  addSeriesMatch,
  HeadStart,
  newSeries,
  Series,
  SeriesLength,
  seriesWinner,
} from './rivalry';
import { matchRecord } from './medallions';
import { Player } from './player.model';
import { randomSeed } from './geometry';
import { MatchOutcome } from './match-engine';
import { MatchPlan, planMatch } from './match-setup';
import { Replay, replayOf } from './replay';
import { dailyLevelId } from './daily';
import { afterMatch, endlessLevelId, isRunOver, newRun } from './endless';
import { replayFromHash } from './replay-link';
import { PlayerStore } from './player.store';
import { PlayerService } from './player.service';
import { ProgressService } from '../progress.service';

/**
 * The most time one frame may take the war forward, in milliseconds. A
 * device slower than that runs the match slower instead of piling up ever
 * more ticks on ever longer frames.
 */
const MAX_FRAME_MS = 3 * TICK_MS;

/**
 * What the next match is set to outside the setup: a ghost to fight, a
 * level picked for it, the daily day it counts for. It holds for one match.
 */
export type OneMatch = Pick<
  GameStateState,
  'ghost' | 'matchLevel' | 'dailyDay'
>;

const NO_ONE_MATCH: OneMatch = {
  ghost: null,
  matchLevel: null,
  dailyDay: null,
};

@Injectable({ providedIn: 'root' })
export class GameStateService {
  private gameStateStore = inject(GameStateStore);
  private playerStore = inject(PlayerStore);
  private playerService = inject(PlayerService);
  private progress = inject(ProgressService);
  /** What the colonies on the board were spawned from - see `initPlayers`. */
  private plan: MatchPlan | null = null;

  /**
   * The ticks of the display frames the game runs on - see
   * {@link FramePacer} and {@link TickClock}.
   */
  private gameLoop$: Observable<GameFrame> = defer(() => {
    const pacer = new FramePacer();
    const clock = new TickClock();
    return animationFrames().pipe(
      map(({ timestamp }) => pacer.frame(timestamp)),
      filter((elapsed) => elapsed != null),
      // After a hidden tab or a stall the war goes on where it stood rather
      // than leap ahead - and the match clock, which judges the medallions,
      // counts only the time that was played.
      map((elapsed) => clock.advance(Math.min(elapsed, MAX_FRAME_MS)))
    );
  });
  private readonly frames = new Subject<GameFrame>();
  private subscriptions?: Subscription;
  private measureFps = new MeasureFps();

  /**
   * Emits every frame of a running match - inside the animation frame, so
   * the war can be advanced with {@link advance} and painted right there.
   */
  public readonly frames$: Observable<GameFrame> = this.frames.asObservable();

  /**
   * Runs the ticks of a display frame. The match may end in any of them;
   * the ones after that are not played, and not counted on the match clock.
   */
  public advance(width: number, height: number, ticks: number): void {
    for (let tick = 0; tick < ticks && this.isRunning(); tick++) {
      // Counted in whole ticks, so the clock lands on every second exactly.
      this.gameStateStore.update((state) => ({
        timePassed: ticksToMs(Math.round(state.timePassed / TICK_MS) + 1),
      }));
      this.playerService.tick(width, height);
      const outcome = this.playerService.outcome();
      if (outcome != null) {
        this.endMatch(outcome);
      }
    }
    this.playerService.endFrame();
  }

  private isRunning(): boolean {
    return untracked(this.gameStateStore.currentState) === GameState.RUNNING;
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
    // Synchronous, so the loop stops inside the update that ends the match.
    const currentState$ = this.gameStateStore.select$(() =>
      this.gameStateStore.currentState()
    );
    const running$ = currentState$.pipe(
      filter((value) => value === GameState.RUNNING)
    );
    const notRunning$ = currentState$.pipe(
      filter((value) => value !== GameState.RUNNING)
    );

    this.subscriptions = running$
      .pipe(switchMap(() => this.gameLoop$.pipe(takeUntil(notRunning$))))
      .subscribe({
        next: (frame) => {
          this.measureFps.signalFrameReady();
          this.frames.next(frame);
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
  }

  /**
   * Ends the match with its outcome and, against the computer, the medallion
   * it earned - judged and remembered right here, so the result and the
   * award reach the store together.
   */
  private endMatch(outcome: MatchOutcome): void {
    const { series, ghost, endless, matchLevel } =
      this.gameStateStore.snapshot();
    const earnings = this.recordMatch(outcome.winner);
    // A match on the endless run's level takes the run on - a draw is no win.
    const run =
      endless !== null && matchLevel === endlessLevelId(endless)
        ? afterMatch(endless, outcome.winner?.isBot === false)
        : endless;
    if (run !== null && run.wins > (endless?.wins ?? 0)) {
      this.progress.recordEndlessRun(run.wins);
    }
    // One update, so the result and the award reach the readers together.
    this.gameStateStore.update({
      // A ghost match is no match to play again: its opponent is no bot.
      ...(ghost === null ? { lastReplay: this.replay() } : {}),
      endless: run,
      currentState: GameState.END,
      winner: outcome.winner,
      matchEnded: true,
      earnings,
      series:
        series === null
          ? null
          : addSeriesMatch(series, winnerSeat(outcome.winner)),
    });
  }

  /** The recording of the match on the board, as far as it got. */
  private replay(): Replay | null {
    return this.plan == null
      ? null
      : replayOf(
          this.plan,
          this.playerService.getSimulation().kind,
          this.playerService.tickCount,
          this.playerService.recorded
        );
  }

  /**
   * Remembers a match that has ended - against the computer its medallion
   * and numbers, between two players that it was played - and returns what
   * it earned. Null for a match against the computer without a human in it.
   */
  private recordMatch(winner: Player | null): MatchEarnings | null {
    const { timePassed, ghost, dailyDay, ...setup } =
      this.gameStateStore.snapshot();
    if (ghost !== null) {
      // Beating your own ghost is for the fun of it - no medallion, no XP.
      return null;
    }
    // The match as it was spawned - a level picked for it included, and
    // whatever the setup was changed to since.
    const { mode, levelId, difficulty, width, colors } = this.plan ?? setup;
    switch (mode) {
      case 'two-players': {
        const seat = winnerSeat(winner);
        return this.progress.recordCouchMatch(
          seat === null ? null : colors[seat]
        );
      }
      case 'vs-computer': {
        const record = matchRecord(untracked(this.playerStore.entities), {
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
        return record === null
          ? null
          : this.progress.recordMatch(record, dailyDay);
      }
    }
  }

  /**
   * Spawns both colonies with the map and the balance of the current level,
   * from a fresh seed - every spawn is a match that may be played. A ghost
   * match is played on the seed of the ghost's run.
   */
  private initPlayers() {
    const {
      width,
      height,
      levelId,
      mode,
      difficulty,
      colors,
      headStart,
      ghost,
      matchLevel,
    } = this.gameStateStore.snapshot();
    this.plan = {
      levelId: matchLevel ?? levelId,
      // A level picked for the match is fought against the computer.
      mode: matchLevel === null ? mode : 'vs-computer',
      difficulty,
      colors,
      headStart,
      width,
      height,
      seed: ghost?.header.seed ?? randomSeed(),
    };
    const { spawns, options } = planMatch(this.plan, ghost);
    this.playerService.init(spawns, options);
  }

  /**
   * Sets the next match on the daily level of that UTC day, against the
   * computer, leaving the setup as it is. It holds for that one match;
   * {@link reset} ends it.
   */
  public playDaily(day: string): void {
    this.gameStateStore.update({
      matchLevel: dailyLevelId(day),
      dailyDay: day,
    });
  }

  /** Starts a new endless run, set up for its first match. */
  public startEndless(): void {
    this.gameStateStore.update({ endless: newRun(randomSeed()) });
    this.continueEndless();
  }

  /**
   * Sets the next match on the level the endless run is at - the next one
   * after a win, the same again after a defeat. Nothing once it is over.
   */
  public continueEndless(): void {
    const { endless } = this.gameStateStore.snapshot();
    if (endless !== null && !isRunOver(endless)) {
      this.gameStateStore.update({
        ...NO_ONE_MATCH,
        matchLevel: endlessLevelId(endless),
      });
    }
  }

  /** Leaves the endless run. */
  public endEndless(): void {
    this.gameStateStore.update({ endless: null });
  }

  /** What the next match is set to outside the setup - see {@link reset}. */
  public oneMatch(): OneMatch {
    const { ghost, matchLevel, dailyDay } = this.gameStateStore.snapshot();
    return { ghost, matchLevel, dailyDay };
  }

  /** Sets the next match as one before it was - for a rematch. */
  public replayOneMatch(match: OneMatch): void {
    this.gameStateStore.update(match);
  }

  /**
   * Offers the run a link carries in `hash` as a ghost to fight. Resolves to
   * whether there was one - a run against the computer, from this version of
   * the game.
   */
  public async offerChallenge(hash: string): Promise<boolean> {
    const run = await replayFromHash(hash);
    if (run === null || run.header.mode !== 'vs-computer') {
      return false;
    }
    this.gameStateStore.update({ challenge: run });
    return true;
  }

  /**
   * Sets the next match against a ghost - the run of the last match against
   * the computer unless another one is given: on its level, the computer's
   * colony steered as the player steered their own back then. It holds for
   * that one match; {@link reset} ends it, whichever way the match is left.
   * The setup stays as it is, the ghost's level and mode are its own.
   */
  public playGhost(run = this.gameStateStore.snapshot().lastReplay): void {
    if (run === null || run.header.mode !== 'vs-computer') {
      return;
    }
    this.gameStateStore.update({ ghost: run, matchLevel: run.header.levelId });
  }

  /**
   * Spawns the colonies of the next match again, now that its setup changed
   * - not during one, which keeps the rules it started with.
   */
  private respawnIfIdle(): void {
    if (this.isIdle()) {
      this.initPlayers();
    }
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
    return !isMatchOn(this.gameStateStore.snapshot().currentState);
  }

  /**
   * Changes how the next match is set up - level, opponent, difficulty or
   * colours.
   *
   * A match keeps the rules it started with: the colonies are only spawned
   * again - with the new map, balance and opponent - while nobody is playing.
   */
  private updateSetup(setup: Partial<MatchSetup>): void {
    const current = this.gameStateStore.snapshot();
    // The same pair again is no change - readers would only redo their work.
    if (setup.colors && sameColors(setup.colors, current.colors)) {
      setup = { ...setup, colors: current.colors };
    }
    // A series is played with one setup: changing it ends the one under way.
    const changed = SERIES_SETUP_KEYS.some(
      (key) =>
        setup[key] !== undefined &&
        JSON.stringify(setup[key]) !== JSON.stringify(current[key])
    );
    this.gameStateStore.update(changed ? { ...setup, series: null } : setup);
    this.respawnIfIdle();
  }

  /**
   * Applies several parts of the setup at once - the colonies are spawned
   * again only once. The values must be valid; the settings check them.
   */
  public applySetup(setup: Partial<MatchSetup>): void {
    this.updateSetup(setup);
  }

  /** Picks the level the next match is played on. */
  public setLevel(levelId: string): void {
    this.updateSetup({ levelId: getLevel(levelId).id });
  }

  /** Switches between two humans and human versus computer. */
  public setMode(mode: GameMode): void {
    this.updateSetup({ mode });
  }

  /** Picks how many matches a series between two players is the best of. */
  public setSeriesLength(seriesLength: SeriesLength): void {
    this.updateSetup({ seriesLength });
  }

  /** Gives one of two players a head start - or neither. */
  public setHeadStart(headStart: HeadStart): void {
    this.updateSetup({ headStart });
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
    this.updateSetup({
      colors: pickColor(
        this.gameStateStore.snapshot().colors,
        seat,
        getColonyColor(colorId).id
      ),
    });
  }

  /**
   * Gives both colonies their colours at once. A pair with an unknown colour
   * or the same colour twice is ignored.
   */
  public setColors(colors: readonly [string, string]): void {
    const valid = validColorPair(colors);
    if (valid != null) {
      this.updateSetup({ colors: valid });
    }
  }

  /** Fires the boost of a player - the touch equivalent of Space / Enter. */
  public boost(playerId: number): void {
    if (!this.isRunning()) {
      return;
    }
    this.playerService.boost(playerId);
  }

  start() {
    this.initPlayers();
    const { dailyDay } = this.gameStateStore.snapshot();
    if (dailyDay !== null) {
      // A restart is an attempt as well.
      this.progress.startDailyAttempt(dailyDay);
    }
    this.gameStateStore.update((state) => ({
      currentState: GameState.RUNNING,
      // A match against a ghost or on a level of its own is no match of a
      // series.
      series: state.matchLevel === null ? nextSeries(state) : null,
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
      ...NO_ONE_MATCH,
    }));
    this.initPlayers();
    this.gameStateStore.update(() => ({
      currentState: GameState.START,
      timePassed: 0,
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

/** The parts of the setup a match is started with. */
export type MatchSetup = Pick<
  GameStateState,
  'levelId' | 'mode' | 'difficulty' | 'colors' | 'seriesLength' | 'headStart'
>;

/**
 * The parts of the setup a series is played with - not the level, which a
 * series moves through, nor the computer's difficulty.
 */
const SERIES_SETUP_KEYS: readonly (keyof MatchSetup)[] = [
  'mode',
  'colors',
  'seriesLength',
  'headStart',
];
