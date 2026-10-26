import { computed, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, map } from 'rxjs';
import { FeatureTogglesService } from '../feature-toggles.service';
import { gpuTrusted } from '../gl/simulation-check';
import { GpuSelfTestService } from '../gl/gpu-self-test.service';
import type { GameText } from '../i18n/game-texts';
import { ModerationService } from '../moderation/moderation.service';
import {
  attemptSeed,
  dailyAttemptId,
  endlessAttemptId,
  endlessRunId,
  nextDailyAttemptId,
  nextRunId,
  parseAttemptId,
  RANKED_DAILY_ATTEMPTS,
  RANKED_RUNS_PER_DAY,
} from '../state/attempts';
import { utcDay } from '../state/daily';
import { PlayerService } from '../state/player.service';
import type {
  RankedMatch,
  RankedOutcome,
  RankedRun,
} from '../state/ranked-match';
import { GameAccount } from '../storage/game-account';
import { GameCloud } from '../storage/game-cloud';

/** The two ranked modes. */
export type RankedKind = 'daily' | 'endless';

/** Why ranked play cannot start now. */
export type RankedBlock = 'banned' | 'signedOut' | 'device';

/** What the new game shows of ranked play in a mode. */
export interface RankedOffer {
  /** True when the next match - or run - is declared as a ranked one. */
  on: boolean;
  /** False while ranked play cannot start: the lines say why. */
  open: boolean;
  /** What the switch's lines say. */
  lines: GameText[];
}

/** A ranked run started, or why it plays unranked. */
export interface RankedRunOutcome extends RankedOutcome {
  /** The run to declare the next matches of - null when unranked. */
  run: RankedRun | null;
}

/** The attempts of a UTC day the player has declared, as last read. */
interface DayAttempts {
  uid: string;
  day: string;
  declared: ReadonlySet<string>;
  voided: ReadonlySet<string>;
}

/**
 * Ranked daily attempts and endless runs (ADR 0012), offered while the
 * owner's toggles (`rankedDaily`, `rankedEndless`) and the game's cloud
 * allow, on a device whose GPU passed the self-test - ranked matches play
 * `gpu-int` only, and live only on the GPU - to a signed-in player no ban
 * holds. Declares each match before it starts (`GameRanked.declare`) and
 * hands out the declared attempt with its seed; the game plays
 * `rankedPlan` from it and uploads the replay with the attempt.
 *
 * A declaration that fails plays the match unranked and says so: offline
 * when it started, the day's attempts or runs used, or - for a later match
 * of a ranked run - the rest of the run unranked.
 */
@Injectable({ providedIn: 'root' })
export class RankedService {
  private readonly ranked = inject(GameCloud).ranked();
  private readonly toggles = inject(FeatureTogglesService).toggles;
  private readonly moderation = inject(ModerationService);
  private readonly players = inject(PlayerService);
  private readonly selfTest = inject(GpuSelfTestService);
  private readonly uid = toSignal(
    inject(GameAccount).players.pipe(
      map(({ playerId }) => playerId),
      distinctUntilChanged()
    ),
    { initialValue: null }
  );
  /** The day's declared attempts, as last read - null before. */
  private readonly attempts = signal<DayAttempts | null>(null);

  /** False without the game's cloud: nothing is ranked then. */
  public readonly available = this.ranked !== null;

  /** True while ranked daily attempts are offered: the cloud and the toggle. */
  public readonly dailyOffered = computed(
    () => this.available && this.toggles().rankedDaily
  );
  /** True while ranked endless runs are offered. */
  public readonly endlessOffered = computed(
    () => this.available && this.toggles().rankedEndless
  );

  /**
   * True on a device that can play a ranked match: the integer GPU passes
   * on a GPU the self-test trusts (ADR 0015) - the owner's policy keeps
   * `IntSimulation` from playing live.
   */
  public readonly deviceReady = computed(
    () => this.players.gpuIntReady() && gpuTrusted(this.selfTest.result())
  );

  /** Why ranked play cannot start now - null while it can. */
  public readonly blocked = computed((): RankedBlock | null => {
    if (this.moderation.banned()) {
      return 'banned';
    }
    if (this.uid() === null) {
      return 'signedOut';
    }
    return this.deviceReady() ? null : 'device';
  });

  /** Ranked daily attempts left today - null until read. */
  public readonly dailyLeft = computed(() => {
    const known = this.today();
    if (known === null) {
      return null;
    }
    let left = 0;
    for (let n = 1; n <= RANKED_DAILY_ATTEMPTS; n++) {
      const id = dailyAttemptId(known.day, n);
      if (!known.declared.has(id) || known.voided.has(id)) {
        left++;
      }
    }
    return left;
  });

  /** Ranked endless runs left to start today - null until read. */
  public readonly runsLeft = computed(() => {
    const known = this.today();
    if (known === null) {
      return null;
    }
    let started = 0;
    for (let r = 1; r <= RANKED_RUNS_PER_DAY; r++) {
      if (known.declared.has(endlessAttemptId(endlessRunId(known.day, r), 0))) {
        started++;
      }
    }
    return RANKED_RUNS_PER_DAY - started;
  });

  /** True when a mode offers ranked play at all. */
  public offered(kind: RankedKind): boolean {
    return kind === 'daily' ? this.dailyOffered() : this.endlessOffered();
  }

  /**
   * What the new game shows of ranked play in a mode, with the player's
   * choice `wanted` (the `ranked` setting) - null where it is not offered:
   * the owner's toggle off hides it.
   */
  public offer(kind: RankedKind, wanted: boolean): RankedOffer | null {
    if (!this.offered(kind)) {
      return null;
    }
    const blocked = this.blocked();
    if (blocked !== null) {
      return {
        on: false,
        open: false,
        lines: [{ key: `boards.ranked.blocked.${blocked}` as const }],
      };
    }
    const left = kind === 'daily' ? this.dailyLeft() : this.runsLeft();
    if (left === 0) {
      return {
        on: false,
        open: false,
        lines: [{ key: `boards.ranked.used.${kind}` as const }],
      };
    }
    if (!wanted) {
      return {
        on: false,
        open: true,
        lines: [{ key: 'boards.ranked.practice' }],
      };
    }
    const total =
      kind === 'daily' ? RANKED_DAILY_ATTEMPTS : RANKED_RUNS_PER_DAY;
    return {
      on: true,
      open: true,
      lines: [
        ...(left === null
          ? []
          : [
              {
                key: `boards.ranked.left.${kind}` as const,
                params: { left, total },
              },
            ]),
        { key: 'boards.ranked.setup' },
        ...(kind === 'endless'
          ? [{ key: 'boards.ranked.runLives' as const }]
          : []),
      ],
    };
  }

  /** True when the next match of a mode is declared ranked, as offered. */
  public wants(kind: RankedKind, wanted: boolean): boolean {
    return this.offer(kind, wanted)?.on === true;
  }

  /**
   * Reads which of today's ranked attempts and runs the player declared -
   * for the counts the new game shows; again on a new day or player.
   */
  public async refresh(): Promise<void> {
    if (this.ranked === null || this.uid() === null) {
      return;
    }
    await this.load(utcDay(new Date()), true);
  }

  /**
   * Declares the next ranked daily attempt of today: a void one again
   * first, else the next not declared. Unranked once the three are used,
   * or when the declaration fails.
   */
  public async declareDaily(): Promise<RankedOutcome> {
    const day = utcDay(new Date());
    const known = await this.load(day);
    if (known === null) {
      return unranked('offline');
    }
    const declared = new Set(known.declared);
    const voided = new Set(known.voided);
    // One try per attempt: an attempt taken already moves on to the next.
    for (let tries = 0; tries < RANKED_DAILY_ATTEMPTS; tries++) {
      const id = nextDailyAttemptId(day, declared, voided);
      if (id === null) {
        return unranked('used');
      }
      const match = await this.declare(id, known, declared, voided);
      if (match === 'taken') {
        continue;
      }
      if (match === null) {
        return unranked('offline');
      }
      const attempt = parseAttemptId(id);
      return {
        match,
        note: { kind: 'daily', n: attempt?.kind === 'daily' ? attempt.n : 1 },
      };
    }
    return unranked('used');
  }

  /**
   * Starts a ranked endless run: declares match 0 of today's next run,
   * whose seed is the run's level seed and the match's. Unranked once the
   * five runs of the day are started, or when the declaration fails.
   */
  public async startRun(): Promise<RankedRunOutcome> {
    const day = utcDay(new Date());
    const known = await this.load(day);
    if (known === null) {
      return { ...unranked('offline'), run: null };
    }
    const declared = new Set(known.declared);
    for (let tries = 0; tries < RANKED_RUNS_PER_DAY; tries++) {
      const runId = nextRunId(day, declared);
      if (runId === null) {
        return { ...unranked('runs-used'), run: null };
      }
      const match = await this.declare(
        endlessAttemptId(runId, 0),
        known,
        declared,
        new Set()
      );
      if (match === 'taken') {
        continue;
      }
      if (match === null) {
        return { ...unranked('offline'), run: null };
      }
      return {
        match,
        note: { kind: 'endless', match: 1 },
        run: { runId, next: 1 },
      };
    }
    return { ...unranked('runs-used'), run: null };
  }

  /**
   * Declares the next match of a ranked run. When it fails - or the match
   * turns out declared already - the rest of the run is unranked: further
   * declarations would fail the level check (ADR 0012).
   */
  public async declareRunMatch(run: RankedRun): Promise<RankedRunOutcome> {
    const result =
      this.ranked === null
        ? 'failed'
        : await this.ranked.declare(endlessAttemptId(run.runId, run.next));
    if (typeof result === 'string') {
      return { ...unranked('run-dropped'), run: null };
    }
    const id = endlessAttemptId(run.runId, run.next);
    return {
      match: matchOf(result.uid, id, result.at),
      note: { kind: 'endless', match: run.next + 1 },
      run: { runId: run.runId, next: run.next + 1 },
    };
  }

  /**
   * Declares one attempt and notes it as declared: the match - `taken`
   * when it was declared already, null when the declaration failed.
   */
  private async declare(
    id: string,
    known: DayAttempts,
    declared: Set<string>,
    voided: Set<string>
  ): Promise<RankedMatch | 'taken' | null> {
    const result =
      this.ranked === null ? 'failed' : await this.ranked.declare(id);
    if (result === 'failed') {
      return null;
    }
    declared.add(id);
    voided.delete(id);
    this.attempts.set({
      ...known,
      declared: new Set(declared),
      voided: new Set(voided),
    });
    return result === 'taken' ? 'taken' : matchOf(result.uid, id, result.at);
  }

  /**
   * The day's declared attempts: as read before for this player and day,
   * else read now (`fresh` reads again) - null when they cannot be read.
   */
  private async load(day: string, fresh = false): Promise<DayAttempts | null> {
    const uid = this.uid();
    const known = this.attempts();
    if (this.ranked === null || uid === null) {
      return null;
    }
    if (!fresh && known !== null && known.uid === uid && known.day === day) {
      return known;
    }
    const ids = [
      ...Array.from({ length: RANKED_DAILY_ATTEMPTS }, (_, i) =>
        dailyAttemptId(day, i + 1)
      ),
      ...Array.from({ length: RANKED_RUNS_PER_DAY }, (_, i) =>
        endlessAttemptId(endlessRunId(day, i + 1), 0)
      ),
    ];
    const read = await this.ranked.declared(ids);
    if (read === null || this.uid() !== uid) {
      return null;
    }
    const loaded: DayAttempts = {
      uid,
      day,
      declared: new Set(read.map((attempt) => attempt.id)),
      voided: new Set(
        read.filter((attempt) => attempt.void).map((attempt) => attempt.id)
      ),
    };
    this.attempts.set(loaded);
    return loaded;
  }

  /** The attempts read for today and this player - null for another day. */
  private today(): DayAttempts | null {
    const known = this.attempts();
    return known !== null &&
      known.uid === this.uid() &&
      known.day === utcDay(new Date())
      ? known
      : null;
  }
}

/** The declared match of an attempt: its server time and its seed. */
function matchOf(uid: string, id: string, at: number): RankedMatch {
  return { attempt: { id, at }, seed: attemptSeed(uid, id, at) };
}

function unranked(
  reason: 'offline' | 'used' | 'runs-used' | 'run-dropped'
): RankedOutcome {
  return { match: null, note: { kind: 'unranked', reason } };
}
