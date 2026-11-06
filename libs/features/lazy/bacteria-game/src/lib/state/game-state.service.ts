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
import {
  addSeriesMatch,
  afterMatch,
  arenaSize,
  BotDifficulty,
  colonyCapacity,
  computerLoadout,
  dailyLevelId,
  endlessLevelId,
  FramePacer,
  GameFrame,
  getColonyColor,
  getLevel,
  gridScale,
  HeadStart,
  isRunOver,
  LADDER_VERSION,
  levelBalance,
  levelDifficulty,
  levelSize,
  MatchEarnings,
  MatchOutcome,
  MatchPlan,
  matchRecord,
  missionById,
  MissionId,
  newRun,
  newSeries,
  ONLINE_SIM_RESOLUTION,
  onOnlineGrid,
  parseAttemptId,
  perfProbeOf,
  pickColor,
  PLAIN_LOADOUT,
  planMatch,
  Player,
  randomSeed,
  type RankedMatch,
  type RankedOutcome,
  rankedPlan,
  type RankedRunOutcome,
  replayFromHash,
  sameColors,
  Series,
  SeriesLength,
  seriesWinner,
  TICK_MS,
  TickClock,
  ticksToMs,
  validColorPair,
} from '@wolsok/feat-shared-bacteria-engine';
import {
  GameMode,
  GameState,
  GameStateState,
  GameStateStore,
  isMatchOn,
  OnlineSeat,
} from './game.states';
import { MatchRecorder, MatchRecording } from './match-recorder';
import { PlayerStore } from './player.store';
import { PlayerService } from './player.service';
import { ProgressService } from '../progress.service';
import { EvolutionService } from '../evolution.service';
import {
  OnlineMatchStart,
  OnlineSeatSync,
  SeatChange,
} from '../net/online-seat-sync';
import { MatchAnalytics, MatchState } from '../analytics/match-analytics';
import {
  type MatchKind,
  type MatchRules,
  type OneMatch,
  canRaceAsGhost,
  rematchOf,
  SETUP_MATCH,
} from './match-rules';

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

/** The seat a local match records: the human's - never the bot's. */
const LOCAL_RECORDED_SEATS: ReadonlySet<number> = new Set([0]);

@Injectable({ providedIn: 'root' })
export class GameStateService {
  private gameStateStore = inject(GameStateStore);
  private playerStore = inject(PlayerStore);
  private playerService = inject(PlayerService);
  private progress = inject(ProgressService);
  private evolution = inject(EvolutionService);
  private readonly seatSync = inject(OnlineSeatSync);
  private matchAnalytics = inject(MatchAnalytics);
  private readonly recorder = inject(MatchRecorder);
  /** What the colonies on the board were spawned from - see `initPlayers`. */
  private plan: MatchPlan | null = null;
  /** Frames in a row an online match could not go on, waiting for the other device. */
  private stalledFrames = 0;

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
  /** The frame-time spec's probe (ADR 0014, gate 3) - null in play. */
  private readonly perfProbe = perfProbeOf(globalThis);

  /**
   * Emits every frame of a running match - inside the animation frame, so
   * the war can be advanced with {@link advance} and painted right there.
   */
  public readonly frames$: Observable<GameFrame> = this.frames.asObservable();

  public constructor() {
    this.seatSync.changes$.subscribe((change) => this.applySeat(change));
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
      if (this.perfProbe === null) {
        this.playerService.tick(width, height);
      } else {
        const start = performance.now();
        this.playerService.tick(width, height);
        this.perfProbe.tickMs.push(performance.now() - start);
      }
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

  /**
   * Takes what the online seat changed and spawns the next match anew - or
   * ends the online match when the connection went.
   */
  private applySeat(change: SeatChange): void {
    if (change.kind === 'ended') {
      this.endOnline();
      return;
    }
    if (change.kind === 'patch') {
      this.gameStateStore.update(change.patch);
    }
    this.respawnIfIdle();
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
    this.gameStateStore.update({ online: null, waitingForPeer: false });
    // A match it ended stays on the board under its result until reset.
    if (!matchOn) {
      this.respawnIfIdle();
    }
  }

  private isRunning(): boolean {
    return untracked(this.gameStateStore.currentState) === GameState.RUNNING;
  }

  /**
   * Starts the next match on an arena of that size: the frame loop of the
   * last one stops, a fresh one waits for the match to run, and the match
   * starts - in that order, which only this method keeps.
   */
  public startMatch(arena: { width: number; height: number }): void {
    this.cleanup();
    this.init(arena.width, arena.height);
    this.start();
  }

  /** Sets the arena up for a match and runs the frame loop while it runs. */
  private init(width: number, height: number): void {
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
    const state = this.gameStateStore.snapshot();
    const { series, endless } = state;
    const { kind } = this.gameStateStore.matchRules();
    // The run's match takes the run on - a draw is no win.
    const run =
      endless !== null && kind === 'endless'
        ? afterMatch(endless, outcome.winner?.isBot === false)
        : null;
    const earnings = this.recordMatch(outcome.winner, run?.wins ?? null);
    this.matchAnalytics.ended(outcome, this.matchState(), earnings);
    const recording = this.recorder.finish(outcome, this.playerService);
    // One update, so the result and the award reach the readers together.
    this.gameStateStore.update({
      ...this.lastReplayAfter(kind, outcome, recording),
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

  /** What the match statistics are told of the match on the board. */
  private matchState(): MatchState {
    const { online, endlessRanked, timePassed } =
      this.gameStateStore.snapshot();
    const { kind, ranked } = this.gameStateStore.matchRules();
    return { online, endlessRanked, timePassed, kind, ranked };
  }

  /**
   * What a match of `kind` leaves to fight as a ghost. A ghost match is no
   * match to play again: its opponent is no bot. One online is its
   * recording, which has no bot to fight as a ghost. A training mission's
   * is none to fight either: its levels are no replay's, and a dummy is no
   * opponent to race.
   */
  private lastReplayAfter(
    kind: MatchKind,
    outcome: MatchOutcome,
    recording: MatchRecording | null
  ): Partial<GameStateState> {
    switch (kind) {
      case 'training':
        return { lastReplay: null };
      case 'online':
        return { lastReplay: recording?.replay ?? null };
      case 'ghost':
        return {};
      default:
        return {
          lastReplay:
            recording?.replay ??
            this.recorder.replay(this.playerService, outcome),
        };
    }
  }

  /**
   * How the match the rules describe is recorded: online and ranked ones
   * always (a ranked one as a local match), another local one while the
   * player records local matches.
   */
  private recordedAsFor({ recording }: MatchRules): 'online' | 'local' | null {
    switch (recording) {
      case 'online':
        return 'online';
      case 'ranked':
        return 'local';
      case 'local':
        return this.recorder.prefs.recordLocal ? 'local' : null;
      case 'none':
        return null;
    }
  }

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
    const { timePassed, next, ...setup } = this.gameStateStore.snapshot();
    const { earns, mission } = this.gameStateStore.matchRules();
    if (!earns) {
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
          ? this.progress.recordMatch(record, {
              dailyDay: next.kind === 'daily' ? next.day : null,
              endlessWins,
            })
          : this.progress.recordTraining(record, missionById(mission));
      }
    }
  }

  /**
   * Spawns both colonies with the map and the balance of the current level,
   * from a fresh seed - every spawn is a match that may be played. A ghost
   * match is played on the seed of the ghost's run.
   */
  private initPlayers(match?: OnlineMatchStart) {
    const { online } = this.gameStateStore.snapshot();
    if (online !== null) {
      this.initOnline(online, match);
      return;
    }
    const { width, height, difficulty, colors, headStart, next } =
      this.gameStateStore.snapshot();
    const rules = this.gameStateStore.matchRules();
    if (rules.rankedMatch !== null) {
      this.initRanked(rules.levelId, rules.rankedMatch);
      return;
    }
    const ghost = next.kind === 'ghost' ? next.run : null;
    this.plan = {
      levelId: rules.levelId,
      mode: rules.planMode,
      // A level with an opponent of its own - a training mission's - plays it.
      difficulty: levelDifficulty(getLevel(rules.levelId), difficulty),
      colors,
      headStart,
      width,
      height,
      seed: ghost?.header.seed ?? randomSeed(),
    };
    // Taken as the colonies spawn: the plan keeps it for the whole match,
    // whatever the storage or the player change meanwhile. The computer
    // evolves with the ladder (ADR 0016); a ghost race has none.
    if (rules.evolves) {
      this.plan.loadouts = [
        untracked(this.evolution.loadout),
        ghost === null
          ? computerLoadout(this.plan.levelId, this.plan.difficulty)
          : PLAIN_LOADOUT,
      ];
      if (ghost === null) {
        this.plan.ladder = LADDER_VERSION;
      }
    }
    const { spawns, options, evolved } = planMatch(this.plan, ghost);
    const recordedAs = this.recordedAsFor(rules);
    this.recorder.begin(this.plan, { as: recordedAs, evolved });
    const records = recordedAs !== null;
    this.playerService.init(spawns, {
      ...options,
      onSecond: this.recorder.sample,
      // On the online grid recorded on a ruleset, a simulation a replay
      // plays back on, whatever the device picks. On another grid the
      // device picks as it would unrecorded: a match the float GPU plays,
      // which has no ruleset, leaves no recording (see `recording`).
      ...(records && onOnlineGrid(this.plan)
        ? { recordedSeats: LOCAL_RECORDED_SEATS }
        : {}),
    });
  }

  /**
   * Spawns the colonies of a ranked match (ADR 0012): the ranked plan of
   * its level and declared seed, whatever the setup says - the normal
   * computer, no head start, the default colours, the online grid -
   * played on `gpu-int` and always recorded. The game lays the arena out
   * on the online grid for it.
   */
  private initRanked(levelId: string, ranked: RankedMatch): void {
    this.plan = rankedPlan(levelId, ranked.seed);
    const { spawns, options, evolved } = planMatch(this.plan, null);
    this.recorder.begin(this.plan, {
      as: this.recordedAsFor(this.gameStateStore.matchRules()),
      ranked,
      evolved,
    });
    this.playerService.init(spawns, {
      ...options,
      onSecond: this.recorder.sample,
      recordedSeats: LOCAL_RECORDED_SEATS,
      ruleset: 'gpu-int',
    });
  }

  /**
   * Spawns the colonies of an online match: the host's setup, on the grid
   * both devices run, played by the lockstep once the match starts.
   */
  private initOnline(online: OnlineSeat, match?: OnlineMatchStart): void {
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
    // Every online match is recorded - both seats, as the lockstep played.
    this.recorder.begin(this.plan, {
      as:
        match === undefined
          ? null
          : this.recordedAsFor(this.gameStateStore.matchRules()),
      onlineRef: match?.ref ?? null,
      evolved,
    });
    this.playerService.init(spawns, {
      ...options,
      onSecond: this.recorder.sample,
      lockstep: match?.lockstep,
      ruleset: match?.ruleset,
    });
  }

  /**
   * Sets the next match on the daily level of that UTC day, against the
   * computer, leaving the setup as it is - or, declared as a ranked attempt
   * (`ranked.match`), on the ranked setup and on the level of the attempt's
   * day, which past midnight may be another than `day`. It holds for that
   * one match; {@link reset} ends it.
   */
  public playDaily(day: string, ranked: RankedOutcome | null = null): void {
    const attempt =
      ranked?.match == null ? null : parseAttemptId(ranked.match.attempt.id);
    const played = attempt?.kind === 'daily' ? attempt.day : day;
    this.gameStateStore.update({
      next: {
        kind: 'daily',
        day: played,
        levelId: dailyLevelId(played),
        ranked,
      },
    });
  }

  /**
   * Sets the next match on a training mission's level, against the easy
   * computer or the training dummy, leaving the setup as it is. It holds
   * for that one match; {@link reset} ends it.
   */
  public playMission(id: MissionId): void {
    this.gameStateStore.update({ next: { kind: 'mission', mission: id } });
  }

  /**
   * Starts a new endless run, set up for its first match. A ranked run
   * (`ranked.run`) takes its levels from the seed of its declared match 0,
   * which that match plays as well (ADR 0012).
   */
  public startEndless(ranked: RankedRunOutcome | null = null): void {
    const match = ranked?.run == null ? null : ranked.match;
    this.gameStateStore.update({
      endless: newRun(match?.seed ?? randomSeed()),
      endlessRanked: null,
    });
    this.continueEndless(ranked);
  }

  /**
   * Sets the next match on the level the endless run is at - the next one
   * after a win, the same again after a defeat. Nothing once it is over.
   * A ranked run's match comes declared (`ranked`); without one the run
   * stays as ranked as it was.
   */
  public continueEndless(ranked: RankedRunOutcome | null = null): void {
    const { endless, endlessRanked } = this.gameStateStore.snapshot();
    if (endless !== null && !isRunOver(endless)) {
      this.gameStateStore.update({
        next: {
          kind: 'endless',
          levelId: endlessLevelId(endless),
          ranked:
            ranked === null ? null : { match: ranked.match, note: ranked.note },
        },
        endlessRanked: ranked === null ? endlessRanked : ranked.run,
      });
    }
  }

  /**
   * What the next match is set to outside the setup, for a rematch - not
   * as a ranked attempt, which is declared anew. See {@link reset}.
   */
  public oneMatch(): OneMatch {
    return rematchOf(this.gameStateStore.snapshot().next);
  }

  /** Sets the next match as one before it was - for a rematch. */
  public replayOneMatch(match: OneMatch): void {
    this.gameStateStore.update({ next: match });
  }

  /**
   * Offers the run a link carries in `hash` as a ghost to fight. Resolves to
   * whether there was one - a run against the computer, from this version of
   * the game.
   */
  public async offerChallenge(hash: string): Promise<boolean> {
    const run = await replayFromHash(hash);
    if (run === null || !canRaceAsGhost(run)) {
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
    if (run === null || !canRaceAsGhost(run)) {
      return;
    }
    this.gameStateStore.update({ next: { kind: 'ghost', run } });
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
  public setArenaSize(width: number, height: number): void {
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
    const seatPatch = this.seatSync.setupChanged(current);
    if (seatPatch !== null) {
      this.gameStateStore.update(seatPatch);
    }
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
   * `EvolutionService.settled`. The stage starts a match with
   * {@link startMatch}, which runs the frame loop too; this starts the
   * match alone, for callers that advance it themselves (the specs).
   */
  public start(): void {
    // Online wins over a one-match setting still set (see `nextMatch`).
    const next = this.gameStateStore.nextMatch();
    if (next.kind === 'online') {
      const match = this.seatSync.matchStart(next.seat);
      if (match === null) {
        return;
      }
      if (match.seat !== next.seat) {
        this.gameStateStore.update({ online: match.seat });
      }
      this.initPlayers(match);
      this.stalledFrames = 0;
    } else {
      this.initPlayers();
    }
    if (next.kind === 'daily') {
      // A restart is an attempt as well.
      this.progress.startDailyAttempt(next.day);
    }
    if (this.plan !== null) {
      this.matchAnalytics.started(
        this.plan,
        this.matchState(),
        this.playerService.getSimulation()
      );
    }
    const { inSeries, kind } = this.gameStateStore.matchRules();
    this.gameStateStore.update((state) => ({
      currentState: GameState.RUNNING,
      series: inSeries ? nextSeries(state.series, state.seriesLength) : null,
      // Any match but the run's leaves the endless run.
      endless: kind === 'endless' ? state.endless : null,
      endlessRanked: kind === 'endless' ? state.endlessRanked : null,
      // Restart from the pause menu starts without a reset in between.
      timePassed: 0,
      winner: null,
      endedBy: null,
      earnings: null,
    }));
  }

  /**
   * Leaves the online match - the connection, and the match if one is on,
   * which the other device then wins.
   */
  public leaveOnline(): void {
    if (!this.seatSync.connected) {
      return;
    }
    // Whoever leaves wins nothing: the match goes with the connection.
    this.gameStateStore.update({ online: null, waitingForPeer: false });
    this.seatSync.leave();
  }

  public reset(): void {
    this.matchAnalytics.left(this.gameStateStore.snapshot().timePassed);
    this.gameStateStore.update(() => ({
      currentState: GameState.END,
      timePassed: 0,
      next: SETUP_MATCH,
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

  /**
   * Switches between RUNNING and PAUSED - bound to the P key and the
   * button. Never pauses a ranked match: its attempt has a deadline from
   * the declaration on (ADR 0012), which a pause would quietly miss.
   */
  public togglePause(): void {
    const { canPause } = this.gameStateStore.matchRules();
    this.gameStateStore.update((state) => {
      if (state.currentState === GameState.RUNNING && canPause) {
        return { currentState: GameState.PAUSED };
      }
      if (state.currentState === GameState.PAUSED) {
        return { currentState: GameState.RUNNING };
      }
      return state;
    });
  }

  public addKeyPress(keyToAdd: string): void {
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

  public removeKeyPress(key: string): void {
    this.gameStateStore.update((state) => ({
      keysPressed: state.keysPressed.filter((keys) => key !== keys),
    }));
  }

  public cleanup(): void {
    this.pause();
    this.gameStateStore.update({ keysPressed: [], fps: 0 });
    this.subscriptions?.unsubscribe();
  }

  public pause(): void {
    this.gameStateStore.update({ currentState: GameState.PAUSED });
  }
}

/**
 * The series a match of a series belongs to: the one under way, a new one
 * once it has been decided.
 */
function nextSeries(series: Series | null, length: SeriesLength): Series {
  return series !== null && seriesWinner(series) === null
    ? series
    : newSeries(length);
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
