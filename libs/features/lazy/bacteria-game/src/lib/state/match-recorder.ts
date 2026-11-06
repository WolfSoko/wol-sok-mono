import { Injectable, Injector, inject, signal } from '@angular/core';
import {
  matchChecksum,
  MatchOutcome,
  MatchPlan,
  Player,
  type RankedMatch,
  Replay,
  ReplayExtras,
  ReplayInputs,
  replayOf,
  replayOutcome,
  replayScore,
  type Ruleset,
  savedRegardless,
  type SizeSample,
} from '@wolsok/feat-shared-bacteria-engine';
import { MatchAnalytics } from '../analytics/match-analytics';
import type { OnlineMatchRef } from '../net/online-match.service';
import { GameReplays } from '../storage/game-replays';

/** A recorded match (ADR 0011), as the last match left it. */
export interface MatchRecording {
  /**
   * The replay - version 2 to 5, on a ruleset. Only one on the online grid
   * is handed over to be kept; another one is for watching again.
   */
  replay: Replay;
  /** The client's `replayScore` of it, 0-100. */
  hint: number;
  /** The id it is kept under once handed over - null before, or if it is not. */
  id: string | null;
}

/** What the player set about recording - see the settings. */
export interface ReplayPrefs {
  /** Local matches against the computer are recorded, on the device's ruleset. */
  recordLocal: boolean;
  /** Recorded local matches are kept; online ones always are (ADR 0012). */
  saveMatches: boolean;
}

/**
 * How the match about to be played is recorded - worked out by whoever
 * spawns it, which knows what kind of match it is.
 */
export interface RecordingStart {
  /** Recorded as an online or a local match - or not at all. */
  as: 'online' | 'local' | null;
  /** The ranked attempt it was declared as - null for an unranked one. */
  ranked: RankedMatch | null;
  /** The room and number of an online match - null for any other. */
  onlineRef: OnlineMatchRef | null;
  /** True when evolution plays a part in it - `planMatch` says. */
  evolved: boolean;
}

/** What the recorder reads of the match being played: the engine, narrowed. */
export interface MatchTape {
  /** The ruleset the simulation plays - null for the float GPU's. */
  readonly ruleset: Ruleset | null;
  readonly tickCount: number;
  readonly recorded: ReplayInputs;
  readonly players: readonly Player[];
}

const NOT_RECORDED: RecordingStart = {
  as: null,
  ranked: null,
  onlineRef: null,
  evolved: false,
};

/**
 * Records the match on the board (ADR 0011): {@link begin} as its colonies
 * spawn, {@link sample} once a second, {@link finish} as it ends - which
 * scores the replay, sets {@link lastRecording} and hands it to
 * `GameReplays` to be kept where the rules and the settings say so.
 */
@Injectable({ providedIn: 'root' })
export class MatchRecorder {
  private readonly matchAnalytics = inject(MatchAnalytics);
  /**
   * Asked for `GameReplays` only once a match is kept: asked any earlier,
   * `GameCloud` would answer before the route named the project.
   */
  private readonly injector = inject(Injector);
  private replayPrefs: ReplayPrefs = { recordLocal: true, saveMatches: true };
  private plan: MatchPlan | null = null;
  private start: RecordingStart = NOT_RECORDED;
  /** The colony sizes after every second of the match on the board. */
  private samples: SizeSample[] = [];

  /** What the player set about recording - the settings tell, these until then. */
  public get prefs(): ReplayPrefs {
    return this.replayPrefs;
  }

  /**
   * The recording of the last match (ADR 0011) - online matches and local
   * ones against the computer, on a ruleset (ADR 0015); null for any other,
   * and for couch, ghost and float GPU matches.
   */
  public readonly lastRecording = signal<MatchRecording | null>(null);

  /** Takes what the player set about recording - from the settings. */
  public setPrefs(prefs: Partial<ReplayPrefs>): void {
    this.replayPrefs = { ...this.replayPrefs, ...prefs };
  }

  /** Starts on the match spawned from `plan`, recorded as `start` says. */
  public begin(plan: MatchPlan, start: Partial<RecordingStart> = {}): void {
    this.plan = plan;
    this.start = { ...NOT_RECORDED, ...start };
    this.samples = [];
  }

  /** Takes the colony sizes once a second, for the recording's score. */
  public readonly sample = (sizes: SizeSample): void => {
    this.samples.push(sizes);
  };

  /**
   * The match as far as `tape` got - with its outcome and checksum once it
   * has one, as a version 2 replay keeps them. Null before {@link begin}.
   */
  public replay(
    tape: MatchTape,
    outcome: MatchOutcome | null = null,
    extras: ReplayExtras = {}
  ): Replay | null {
    if (this.plan === null) {
      return null;
    }
    const end = replayOutcome(outcome);
    return replayOf(
      this.plan,
      tape.ruleset ?? 'gpu',
      tape.tickCount,
      tape.recorded,
      {
        ...extras,
        ...(end === null
          ? {}
          : { outcome: end, checksum: matchChecksum(tape.players) }),
      },
      this.start.evolved
    );
  }

  /**
   * The recording of the match that has just ended, handed over to be kept
   * - online and ranked always, a local one with "Save my matches" on (ADR
   * 0011, 0012), on whatever simulation resolution it was played. Null for
   * a match that was not recorded, and for any but the first finish.
   */
  public finish(outcome: MatchOutcome, tape: MatchTape): MatchRecording | null {
    const start = this.start;
    // Recorded once: the replay of the match stays at hand, evolved or not.
    this.start = { ...NOT_RECORDED, evolved: start.evolved };
    const recording =
      tape.ruleset === null ? null : this.record(outcome, tape, start);
    this.lastRecording.set(recording);
    if (recording !== null) {
      this.keep(recording, start.as === 'online');
    }
    return recording;
  }

  private record(
    outcome: MatchOutcome,
    tape: MatchTape,
    { as, ranked: rankedMatch, onlineRef }: RecordingStart
  ): MatchRecording | null {
    if (as === null || (as === 'online' && onlineRef === null)) {
      return null;
    }
    // A ranked match carries its attempt - on the one ruleset the boards
    // take (ADR 0012, 0015), which it always plays.
    const ranked = tape.ruleset === 'gpu-int' ? rankedMatch : null;
    const replay = this.replay(
      tape,
      outcome,
      as === 'online' && onlineRef !== null
        ? { roomCode: onlineRef.roomCode, n: onlineRef.n }
        : ranked !== null
          ? { attempt: ranked.attempt }
          : {}
    );
    const end = replayOutcome(outcome);
    if (replay === null || end === null) {
      return null;
    }
    const { score } = replayScore({
      samples: this.samples,
      outcome: end,
      ticks: replay.header.ticks,
      online: as === 'online',
    });
    return { replay, hint: score, id: null };
  }

  /**
   * Hands the recording over to be kept - an online or ranked match
   * whatever the settings say - and notes the id it is kept under.
   */
  private keep(recording: MatchRecording, online: boolean): void {
    const { replay, hint } = recording;
    if (!savedRegardless(replay.header) && !this.prefs.saveMatches) {
      return;
    }
    const attempt = replay.header.attempt?.id;
    this.injector
      .get(GameReplays)
      .submit({ replay, hint, ...(attempt === undefined ? {} : { attempt }) })
      .then(
        (id) => {
          if (id === null) {
            return;
          }
          this.matchAnalytics.replaySaved(online, attempt !== undefined);
          if (this.lastRecording() === recording) {
            this.lastRecording.set({ ...recording, id });
          }
        },
        (error: unknown) => console.warn('The replay was not kept', error)
      );
  }
}
