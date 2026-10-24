import { Injectable, Injector, inject, signal, untracked } from '@angular/core';
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
import { FramePacer } from './frame-pacer';
import { GameFrame, TICK_MS, TickClock, ticksToMs } from './fixed-tick';
import { BotDifficulty } from './bot-controller';
import {
  getColonyColor,
  onlineColors,
  pickColor,
  sameColors,
  seatFirst,
  validColorPair,
} from './colony-colors';
import {
  GameMode,
  GameState,
  GameStateState,
  GameStateStore,
  isMatchOn,
  OnlineSeat,
} from './game.states';
import {
  getLevel,
  gridScale,
  levelBalance,
  levelSize,
  LEVELS,
  playableOnline,
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
} from './rivalry';
import { matchRecord } from './medallions';
import { Player } from './player.model';
import { randomSeed } from './geometry';
import { MatchOutcome } from './win-conditions';
import { MatchPlan, planMatch } from './match-setup';
import { Replay, ReplayExtras, replayOf, replayOutcome } from './replay';
import { matchChecksum } from './checksum';
import { replayScore } from './replay-score';
import type { SizeSample } from './match-engine';
import { GameReplays } from '../storage/game-replays';
import { dailyLevelId } from './daily';
import { afterMatch, endlessLevelId, isRunOver, newRun } from './endless';
import {
  MissionId,
  missionOf,
  MISSIONS,
  TRAINING_DIFFICULTY,
} from './training';
import { replayFromHash } from './replay-link';
import { PlayerStore } from './player.store';
import { PlayerService } from './player.service';
import { ProgressService } from '../progress.service';
import { EvolutionService } from '../evolution.service';
import { PLAIN_LOADOUT } from './evolution';
import { OnlineEvent, OnlineMatchService } from '../net/online-match.service';
import type { Lockstep } from '../net/lockstep';
import type { OnlineSetup } from '../net/net-message';
import { arenaSize, ONLINE_SIM_RESOLUTION } from './arena-size';

/**
 * The most time one frame may take the war forward, in milliseconds. A
 * device slower than that runs the match slower instead of piling up ever
 * more ticks on ever longer frames.
 */
const MAX_FRAME_MS = 3 * TICK_MS;

/**
 * Frames an online match may wait for the other device before it says so:
 * a short stutter on a slow connection is no news.
 */
const WAIT_NOTICE_FRAMES = 20;

/**
 * What the next match is set to outside the setup: a ghost to fight, a
 * level picked for it, the daily day it counts for. It holds for one match.
 */
export type OneMatch = Pick<
  GameStateState,
  'ghost' | 'matchLevel' | 'dailyDay' | 'endlessMatch'
>;

/** The seat a local match records: the human's - never the bot's. */
const LOCAL_RECORDED_SEATS: ReadonlySet<number> = new Set([0]);

/** A recorded match (ADR 0011), as the last match left it. */
export interface MatchRecording {
  /** The version 2 replay, on the CPU and the online grid. */
  replay: Replay;
  /** The client's `replayScore` of it, 0-100. */
  hint: number;
  /** The id it is kept under once handed over - null before, or if it is not. */
  id: string | null;
}

/** What the player set about recording - see the settings. */
export interface ReplayPrefs {
  /** Local matches against the computer are recorded, on the CPU. */
  recordLocal: boolean;
  /** Recorded local matches are kept; online ones always are (ADR 0012). */
  saveMatches: boolean;
}

const NO_ONE_MATCH: OneMatch = {
  ghost: null,
  matchLevel: null,
  dailyDay: null,
  endlessMatch: false,
};

@Injectable({ providedIn: 'root' })
export class GameStateService {
  private gameStateStore = inject(GameStateStore);
  private playerStore = inject(PlayerStore);
  private playerService = inject(PlayerService);
  private progress = inject(ProgressService);
  private evolution = inject(EvolutionService);
  private online = inject(OnlineMatchService);
  /**
   * Asked for `GameReplays` only once a match is kept: asked any earlier,
   * `GameCloud` would answer before the route named the project.
   */
  private injector = inject(Injector);
  /** What the player set about recording - the settings tell. */
  private replayPrefs: ReplayPrefs = { recordLocal: false, saveMatches: true };
  /** Whether the match on the board is recorded, and how - null if not. */
  private recordedAs: 'online' | 'local' | null = null;
  /** The room and number of the online match on the board. */
  private onlineRef: { roomCode: string; n: number } | null = null;
  /** The colony sizes after every second of the match on the board. */
  private samples: SizeSample[] = [];
  /** What the colonies on the board were spawned from - see `initPlayers`. */
  private plan: MatchPlan | null = null;
  /** True when evolution plays a part in that match - `planMatch` says. */
  private planEvolved = false;
  /** Frames in a row an online match could not go on, waiting for the other device. */
  private stalledFrames = 0;
  /**
   * The host's word of the guest's own colours, null before it came - what
   * the host makes the online pair from, with its own.
   */
  private guestColors: [string, string] | null = null;

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
   * The recording of the last match (ADR 0011) - online matches and local
   * ones against the computer on the CPU; null for any other, and for
   * couch, ghost and GPU matches.
   */
  public readonly lastRecording = signal<MatchRecording | null>(null);

  public constructor() {
    this.online.events$.subscribe((event) => this.onOnline(event));
  }

  /**
   * Runs the ticks of a display frame. The match may end in any of them;
   * the ones after that are not played, and not counted on the match clock.
   */
  public advance(width: number, height: number, ticks: number): void {
    let played = 0;
    // An online match waits for the other device's inputs: the ticks it
    // cannot play now are not made up later, both devices slow down alike.
    for (
      ;
      played < ticks && this.isRunning() && this.playerService.canTick();
      played++
    ) {
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
    // Checked here too: a device that waits on the other one plays no tick.
    if (this.isRunning() && this.playerService.desynced) {
      this.endMatch({ winner: null, reason: 'desync' });
    }
    this.noteStall(this.isRunning() && ticks > 0 && played === 0);
    this.playerService.endFrame();
  }

  /** Tells the player once an online match has waited for a while. */
  private noteStall(stalled: boolean): void {
    if (!stalled && this.stalledFrames === 0) {
      return;
    }
    this.stalledFrames = stalled ? this.stalledFrames + 1 : 0;
    const waiting = this.stalledFrames > WAIT_NOTICE_FRAMES;
    if (waiting !== this.gameStateStore.snapshot().waitingForPeer) {
      this.gameStateStore.update({ waitingForPeer: waiting });
    }
  }

  /** Takes what the player set about recording - from the settings. */
  public setReplayPrefs(prefs: Partial<ReplayPrefs>): void {
    this.replayPrefs = { ...this.replayPrefs, ...prefs };
  }

  /** Follows the online match: the lobby, the host's setup, the connection. */
  private onOnline(event: OnlineEvent): void {
    switch (event.type) {
      case 'connected': {
        const state = this.gameStateStore.snapshot();
        const levelId = playableOnline(getLevel(state.levelId))
          ? state.levelId
          : LEVELS[0].id;
        this.guestColors = null;
        // The guest waits for the host's pair in its own colour - and tells
        // the host what it picked, for the host to make the pair from.
        const colors =
          event.seat === 0
            ? onlineColors(state.colors, null)
            : seatFirst(state.colors, 1);
        this.gameStateStore.update({
          levelId,
          online: { seat: event.seat, levelId, colors },
        });
        if (event.seat === 0) {
          this.online.share({ levelId, colors });
        } else {
          this.online.offerColors(state.colors);
        }
        this.respawnIfIdle();
        return;
      }
      case 'colors': {
        if (this.gameStateStore.snapshot().online?.seat === 0) {
          this.guestColors = event.colors;
          this.shareSetup();
          this.respawnIfIdle();
        }
        return;
      }
      case 'setup': {
        const { online } = this.gameStateStore.snapshot();
        if (online !== null && !sameSetup(online, event.setup)) {
          this.gameStateStore.update({
            online: { ...online, ...event.setup },
          });
          this.respawnIfIdle();
        }
        return;
      }
      case 'ended':
        this.endOnline();
        return;
      case 'start':
        // The game component starts the match - see `start`.
        return;
    }
  }

  /**
   * The online connection is gone: a match under way is won by the player
   * still here, and the game is back to this device's setup.
   */
  private endOnline(): void {
    const { online, currentState } = this.gameStateStore.snapshot();
    if (online === null) {
      return;
    }
    const matchOn = isMatchOn(currentState);
    if (matchOn) {
      const winner =
        untracked(this.playerStore.entities).find(
          (player) => player.id === online.seat
        ) ?? null;
      this.endMatch({ winner, reason: 'forfeit' });
    }
    this.guestColors = null;
    this.gameStateStore.update({ online: null, waitingForPeer: false });
    // A match it ended stays on the board under its result until reset.
    if (!matchOn) {
      this.respawnIfIdle();
    }
  }

  /** The host tells the guest when the next match is set up anew. */
  private shareSetup(): void {
    const { online, levelId, colors } = this.gameStateStore.snapshot();
    // The pair is made here and only here: the guest plays what it is sent.
    const setup = { levelId, colors: onlineColors(colors, this.guestColors) };
    if (online?.seat !== 0 || sameSetup(online, setup)) {
      return;
    }
    this.gameStateStore.update({ online: { ...online, ...setup } });
    this.online.share(setup);
  }

  private isRunning(): boolean {
    return untracked(this.gameStateStore.currentState) === GameState.RUNNING;
  }

  init(width: number, height: number) {
    this.gameStateStore.update({
      width,
      height,
      winner: null,
      endedBy: null,
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
    const { series, ghost, endless, endlessMatch, online } =
      this.gameStateStore.snapshot();
    // The run's match takes the run on - a draw is no win.
    const run =
      endless !== null && endlessMatch
        ? afterMatch(endless, outcome.winner?.isBot === false)
        : null;
    const earnings = this.recordMatch(outcome.winner, run?.wins ?? null);
    const recording = this.recording(outcome);
    // One update, so the result and the award reach the readers together.
    this.gameStateStore.update({
      // A ghost match is no match to play again: its opponent is no bot.
      // One online is its recording, which has no bot to fight as a ghost.
      ...(online !== null
        ? { lastReplay: recording?.replay ?? null }
        : ghost === null
          ? { lastReplay: recording?.replay ?? this.replay(outcome) }
          : {}),
      waitingForPeer: false,
      endless: run,
      currentState: GameState.END,
      winner: outcome.winner,
      endedBy: outcome.reason,
      earnings,
      series:
        series === null
          ? null
          : addSeriesMatch(series, winnerSeat(outcome.winner)),
    });
  }

  /**
   * The recording of the match on the board, as far as it got - with its
   * outcome and checksum once it has one, as a version 2 replay keeps them.
   */
  private replay(
    outcome: MatchOutcome | null = null,
    extras: ReplayExtras = {}
  ): Replay | null {
    const end = replayOutcome(outcome);
    return this.plan == null
      ? null
      : replayOf(
          this.plan,
          this.playerService.getSimulation().kind,
          this.playerService.tickCount,
          this.playerService.recorded,
          {
            ...extras,
            ...(end === null
              ? {}
              : {
                  outcome: end,
                  checksum: matchChecksum(this.playerService.players),
                }),
          },
          this.planEvolved
        );
  }

  /**
   * The recording of a match that has just ended, handed over to be kept
   * - online always, a local one with "Save my matches" on (ADR 0011, 0012).
   * Null for a match that was not recorded.
   */
  private recording(outcome: MatchOutcome): MatchRecording | null {
    const recordedAs = this.recordedAs;
    this.recordedAs = null;
    if (
      recordedAs === null ||
      this.playerService.getSimulation().kind !== 'cpu' ||
      (recordedAs === 'online' && this.onlineRef === null)
    ) {
      this.lastRecording.set(null);
      return null;
    }
    const replay = this.replay(
      outcome,
      recordedAs === 'online' && this.onlineRef !== null
        ? { roomCode: this.onlineRef.roomCode, n: this.onlineRef.n }
        : {}
    );
    const end = replayOutcome(outcome);
    if (replay === null || end === null) {
      this.lastRecording.set(null);
      return null;
    }
    const { score } = replayScore({
      samples: this.samples,
      outcome: end,
      ticks: replay.header.ticks,
      online: recordedAs === 'online',
    });
    const recording: MatchRecording = { replay, hint: score, id: null };
    this.lastRecording.set(recording);
    if (recordedAs === 'online' || this.replayPrefs.saveMatches) {
      this.injector
        .get(GameReplays)
        .submit({ replay, hint: score })
        .then(
          (id) => {
            if (id !== null && this.lastRecording() === recording) {
              this.lastRecording.set({ ...recording, id });
            }
          },
          (error: unknown) => console.warn('The replay was not kept', error)
        );
    }
    return recording;
  }

  /**
   * Whether a local match from `plan` is recorded: against the computer,
   * no ghost, with recording on - and on the online grid of its level, the
   * one a stored replay is checked on.
   */
  private recordsLocal(plan: MatchPlan, ghost: Replay | null): boolean {
    const grid = arenaSize(
      ONLINE_SIM_RESOLUTION,
      levelSize(getLevel(plan.levelId))
    );
    return (
      this.replayPrefs.recordLocal &&
      ghost === null &&
      missionOf(plan.levelId) === null &&
      plan.mode === 'vs-computer' &&
      plan.width === grid.width &&
      plan.height === grid.height
    );
  }

  /** Takes the colony sizes once a second, for the recording's score. */
  private readonly sample = (sizes: SizeSample) => this.samples.push(sizes);

  /**
   * Remembers a match that has ended - against the computer its medallion
   * and numbers, between two players that it was played - and returns what
   * it earned. Null for a match against the computer without a human in it.
   */
  private recordMatch(
    winner: Player | null,
    /** The levels the endless run has beaten after this match, if it was one. */
    endlessWins: number | null
  ): MatchEarnings | null {
    const { timePassed, ghost, dailyDay, online, ...setup } =
      this.gameStateStore.snapshot();
    if (ghost !== null || online !== null) {
      // Beating your own ghost is for the fun of it - no medallion, no XP.
      // An online match counts for nothing either: it is played for fun.
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
        const level = getLevel(levelId);
        const mission = missionOf(levelId);
        const record = matchRecord(untracked(this.playerStore.entities), {
          levelId,
          difficulty,
          // Whole seconds, as the match clock shows them.
          durationSec: Math.floor(timePassed / 1000),
          winner,
          // The cap the simulation holds each of the two colonies to.
          capacity: colonyCapacity(
            levelBalance(level, gridScale(level, width)),
            2
          ),
        });
        if (record === null) {
          return null;
        }
        return mission === null
          ? this.progress.recordMatch(record, { dailyDay, endlessWins })
          : this.progress.recordTraining(record, mission);
      }
    }
  }

  /**
   * Spawns both colonies with the map and the balance of the current level,
   * from a fresh seed - every spawn is a match that may be played. A ghost
   * match is played on the seed of the ghost's run.
   */
  private initPlayers(match?: { seed: number; lockstep: Lockstep }) {
    const { online } = this.gameStateStore.snapshot();
    if (online !== null) {
      this.initOnline(online, match);
      return;
    }
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
    const planned = matchLevel ?? levelId;
    this.plan = {
      levelId: planned,
      mode: planModeOf(mode, matchLevel),
      // A training mission is always played against the easy computer.
      difficulty:
        missionOf(planned) === null ? difficulty : TRAINING_DIFFICULTY,
      colors,
      headStart,
      width,
      height,
      seed: ghost?.header.seed ?? randomSeed(),
    };
    // Taken as the colonies spawn: the plan keeps it for the whole match,
    // whatever the storage or the player change meanwhile.
    if (this.evolves()) {
      this.plan.loadouts = [untracked(this.evolution.loadout), PLAIN_LOADOUT];
    }
    const { spawns, options, evolved } = planMatch(this.plan, ghost);
    this.planEvolved = evolved;
    const records = this.recordsLocal(this.plan, ghost);
    this.recordedAs = records ? 'local' : null;
    this.onlineRef = null;
    this.samples = [];
    this.playerService.init(spawns, {
      ...options,
      onSecond: this.sample,
      // Recorded on the CPU, the simulation a replay plays back on.
      ...(records ? { recordedSeats: LOCAL_RECORDED_SEATS } : {}),
    });
  }

  /**
   * True when the next match is one the evolution plays in: against the
   * computer or a ghost on the ladder or a generated level - see
   * `evolution.ts`. The daily level and endless runs feed the leaderboards
   * and stay plain, as do couch and online matches and the training
   * missions, which teach the colony every player starts with.
   */
  private evolves(): boolean {
    const { online, mode, matchLevel, dailyDay, endlessMatch } =
      this.gameStateStore.snapshot();
    return (
      online === null &&
      planModeOf(mode, matchLevel) === 'vs-computer' &&
      dailyDay === null &&
      !endlessMatch &&
      (matchLevel === null || missionOf(matchLevel) === null)
    );
  }

  /**
   * Spawns the colonies of an online match: the host's setup, on the grid
   * both devices run, played by the lockstep once the match starts.
   */
  private initOnline(
    online: OnlineSeat,
    match?: { seed: number; lockstep: Lockstep }
  ): void {
    const { difficulty } = this.gameStateStore.snapshot();
    const { width, height } = arenaSize(
      ONLINE_SIM_RESOLUTION,
      levelSize(getLevel(online.levelId))
    );
    this.plan = {
      levelId: online.levelId,
      mode: 'two-players',
      difficulty,
      colors: online.colors,
      headStart: 0,
      width,
      height,
      seed: match?.seed ?? 0,
    };
    const { spawns, options, evolved } = planMatch(this.plan, null, {
      seat: online.seat,
      drivers: match?.lockstep.drivers() ?? new Map(),
    });
    this.planEvolved = evolved;
    // Every online match is recorded - both seats, as the lockstep played.
    this.recordedAs = match === undefined ? null : 'online';
    this.samples = [];
    this.playerService.init(spawns, {
      ...options,
      onSecond: this.sample,
      lockstep: match?.lockstep,
    });
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

  /**
   * Sets the next match on a training mission's level, against the easy
   * computer or the training dummy, leaving the setup as it is. It holds
   * for that one match; {@link reset} ends it.
   */
  public playMission(id: MissionId): void {
    const mission = MISSIONS.find((each) => each.id === id);
    if (mission !== undefined) {
      this.gameStateStore.update({
        ...NO_ONE_MATCH,
        matchLevel: mission.levelId,
      });
    }
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
        endlessMatch: true,
      });
    }
  }

  /** On with the endless run after a match - or a new one, once it is over. */
  public advanceEndless(): void {
    const { endless } = this.gameStateStore.snapshot();
    if (endless === null || isRunOver(endless)) {
      this.startEndless();
    } else {
      this.continueEndless();
    }
  }

  /** What the next match is set to outside the setup - see {@link reset}. */
  public oneMatch(): OneMatch {
    const { ghost, matchLevel, dailyDay, endlessMatch } =
      this.gameStateStore.snapshot();
    return { ghost, matchLevel, dailyDay, endlessMatch };
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
    // The guest's colours are its own pick: the host makes the pair of
    // the match from them.
    if (
      setup.colors !== undefined &&
      setup.colors !== current.colors &&
      current.online?.seat === 1
    ) {
      this.online.offerColors(setup.colors);
    }
    this.shareSetup();
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

  /** Fires a player's weapon - the button equivalent of its key. */
  public fireWeapon(playerId: number): void {
    if (!this.isRunning()) {
      return;
    }
    this.playerService.fireWeapon(playerId);
  }

  /**
   * Starts the match, with what the player evolved as it is known now: the
   * match never waits on storage, and once it runs its loadouts are fixed.
   * The new game's Start waits for the evolution instead - see
   * `EvolutionService.settled`.
   */
  start(): void {
    const { online, dailyDay } = this.gameStateStore.snapshot();
    if (online !== null) {
      const match = this.onlineMatch(online);
      if (match === null) {
        return;
      }
      this.initPlayers(match);
      this.stalledFrames = 0;
    } else {
      this.initPlayers();
    }
    if (dailyDay !== null) {
      // A restart is an attempt as well.
      this.progress.startDailyAttempt(dailyDay);
    }
    this.gameStateStore.update((state) => ({
      currentState: GameState.RUNNING,
      // A match against a ghost, on a level of its own or online is no
      // match of a series.
      series:
        state.matchLevel === null && online === null ? nextSeries(state) : null,
      // Any match but the run's leaves the endless run.
      endless: state.endlessMatch ? state.endless : null,
      // Restart from the pause menu starts without a reset in between.
      timePassed: 0,
      winner: null,
      endedBy: null,
      earnings: null,
    }));
  }

  /**
   * The online match to start: the host picks the seed and tells the guest,
   * the guest takes the match the host started - and neither starts one on
   * its own. Null when there is none to start.
   */
  private onlineMatch(
    online: OnlineSeat
  ): { seed: number; lockstep: Lockstep } | null {
    if (online.seat === 0) {
      const seed = randomSeed();
      const lockstep = this.online.startMatch({
        levelId: online.levelId,
        colors: online.colors,
        seed,
      });
      this.onlineRef = this.online.matchRef();
      return lockstep === null ? null : { seed, lockstep };
    }
    const taken = this.online.takeStart();
    if (taken === null) {
      return null;
    }
    this.onlineRef = this.online.matchRef();
    const { levelId, colors, seed } = taken.start;
    this.gameStateStore.update({ online: { ...online, levelId, colors } });
    return { seed, lockstep: taken.lockstep };
  }

  /**
   * Leaves the online match - the connection, and the match if one is on,
   * which the other device then wins.
   */
  public leaveOnline(): void {
    if (this.online.lobby().phase === 'idle') {
      return;
    }
    // Whoever leaves wins nothing: the match goes with the connection.
    this.guestColors = null;
    this.gameStateStore.update({ online: null, waitingForPeer: false });
    this.online.leave();
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
      endedBy: null,
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

/** True when two online setups set the same match up. */
function sameSetup(a: OnlineSetup, b: OnlineSetup): boolean {
  return a.levelId === b.levelId && sameColors(a.colors, b.colors);
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

/**
 * The mode a match is planned in: a level picked for the match is fought
 * against the computer, whatever the mode set.
 */
function planModeOf(mode: GameMode, matchLevel: string | null): GameMode {
  return matchLevel === null ? mode : 'vs-computer';
}
