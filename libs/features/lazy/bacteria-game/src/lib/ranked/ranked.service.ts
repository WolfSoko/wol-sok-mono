import { computed, inject, Injectable, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, map } from 'rxjs';
import { FeatureTogglesService } from '../feature-toggles.service';
import { gpuTrusted } from '../gl/simulation-check';
import { GpuSelfTestService } from '../gl/gpu-self-test.service';
import type { GameText } from '../i18n/game-texts';
import { ModerationService } from '../moderation/moderation.service';
import {
  attemptSeed,
  dailyAttemptsLeft,
  dayAttemptIds,
  endlessAttemptId,
  nextDailyAttemptId,
  nextRunId,
  parseAttemptId,
  RANKED_DAILY_ATTEMPTS,
  RANKED_RUNS_PER_DAY,
  runsLeft,
} from '../state/attempts';
import { utcDay } from '../state/daily';
import { PlayerService } from '../state/player.service';
import type {
  RankedMatch,
  RankedOutcome,
  RankedRun,
  RankedRunOutcome,
  UnrankedReason,
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
  /**
   * The UTC day as last looked at - again before each start and each
   * read (`currentDay`), so a new day's attempts are offered after 00:00.
   */
  private readonly today = signal(utcDay(new Date()));
  /** The attempts read for today and this player - null for another day. */
  private readonly known = computed((): DayAttempts | null => {
    const known = this.attempts();
    return known !== null &&
      known.uid === this.uid() &&
      known.day === this.today()
      ? known
      : null;
  });

  /** False without the game's cloud: nothing is ranked then. */
  private readonly available = this.ranked !== null;

  /** True while ranked daily attempts are offered: the cloud and the toggle. */
  private readonly dailyOffered = computed(
    () => this.available && this.toggles().rankedDaily
  );
  /** True while ranked endless runs are offered. */
  private readonly endlessOffered = computed(
    () => this.available && this.toggles().rankedEndless
  );

  /**
   * True on a device that can play a ranked match: the integer GPU passes
   * on a GPU the self-test trusts (ADR 0015) - the owner's policy keeps
   * `IntSimulation` from playing live.
   */
  private readonly deviceReady = computed(
    () => this.players.gpuIntReady() && gpuTrusted(this.selfTest.result())
  );

  /** Why ranked play cannot start now - null while it can. */
  private readonly blocked = computed((): RankedBlock | null => {
    if (this.moderation.banned()) {
      return 'banned';
    }
    if (this.uid() === null) {
      return 'signedOut';
    }
    return this.deviceReady() ? null : 'device';
  });

  /** Ranked daily attempts left today - null until read. */
  private readonly dailyLeft = computed(() => {
    const known = this.known();
    return known === null
      ? null
      : dailyAttemptsLeft(known.day, known.declared, known.voided);
  });

  /** Ranked endless runs left to start today - null until read. */
  private readonly runsLeft = computed(() => {
    const known = this.known();
    return known === null ? null : runsLeft(known.day, known.declared);
  });

  /**
   * What the new game shows of ranked play in a mode, with the player's
   * choice `wanted` (the `ranked` setting) - null where it is not offered:
   * the owner's toggle off hides it.
   */
  public offer(kind: RankedKind, wanted: boolean): RankedOffer | null {
    if (!(kind === 'daily' ? this.dailyOffered() : this.endlessOffered())) {
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
        { key: 'boards.ranked.noPause' },
        ...(kind === 'endless'
          ? [{ key: 'boards.ranked.runLives' as const }]
          : []),
      ],
    };
  }

  /**
   * True when the next match of a mode is declared ranked, as offered -
   * on the UTC day of now: past midnight a new day's attempts are offered,
   * not the old day's counts.
   */
  public wants(kind: RankedKind, wanted: boolean): boolean {
    this.currentDay();
    return this.offer(kind, wanted)?.on === true;
  }

  /**
   * Reads which of today's ranked attempts and runs the player declared -
   * for the counts the new game shows: again from the storage (`fresh`),
   * or as read before for this player and day.
   */
  public async refresh(fresh = true): Promise<void> {
    if (this.ranked === null || this.uid() === null) {
      return;
    }
    await this.load(this.currentDay(), fresh);
  }

  /**
   * Declares the next ranked daily attempt of today: a void one again
   * first, else the next not declared. Unranked once the three are used,
   * or when the declaration fails.
   */
  public async declareDaily(): Promise<RankedOutcome> {
    const match = await this.declareNext(
      RANKED_DAILY_ATTEMPTS,
      nextDailyAttemptId
    );
    if (typeof match === 'string') {
      return unranked(match);
    }
    const attempt = parseAttemptId(match.attempt.id);
    return {
      match,
      note: { kind: 'daily', n: attempt?.kind === 'daily' ? attempt.n : 1 },
    };
  }

  /**
   * Starts a ranked endless run: declares match 0 of today's next run,
   * whose seed is the run's level seed and the match's. Unranked once the
   * five runs of the day are started, or when the declaration fails.
   */
  public async startRun(): Promise<RankedRunOutcome> {
    const match = await this.declareNext(
      RANKED_RUNS_PER_DAY,
      (day, declared) => {
        const runId = nextRunId(day, declared);
        return runId === null ? null : endlessAttemptId(runId, 0);
      }
    );
    const attempt =
      typeof match === 'string' ? null : parseAttemptId(match.attempt.id);
    if (typeof match === 'string' || attempt?.kind !== 'endless') {
      return {
        ...unranked(match === 'used' ? 'runs-used' : 'offline'),
        run: null,
      };
    }
    return {
      match,
      note: { kind: 'endless', match: 1 },
      run: { runId: attempt.runId, next: 1 },
    };
  }

  /**
   * Declares the next match of a ranked run. When it fails - or the match
   * turns out declared already - the rest of the run is unranked: further
   * declarations would fail the level check (ADR 0012).
   */
  public async declareRunMatch(run: RankedRun): Promise<RankedRunOutcome> {
    const id = endlessAttemptId(run.runId, run.next);
    const result =
      this.ranked === null ? 'failed' : await this.ranked.declare(id);
    if (typeof result === 'string') {
      return { ...unranked('run-dropped'), run: null };
    }
    return {
      match: matchOf(result.uid, id, result.at),
      note: { kind: 'endless', match: run.next + 1 },
      run: { runId: run.runId, next: run.next + 1 },
    };
  }

  /**
   * Declares the next attempt of today that `next` picks from the declared
   * ones, noting each as declared: one taken already moves on to the next
   * (`tries` at most). The declared match - `used` once `next` picks none,
   * `offline` when the attempts cannot be read or a declaration fails.
   */
  private async declareNext(
    tries: number,
    next: (
      day: string,
      declared: ReadonlySet<string>,
      voided: ReadonlySet<string>
    ) => string | null
  ): Promise<RankedMatch | 'used' | 'offline'> {
    const day = this.currentDay();
    const known = await this.load(day);
    if (known === null || this.ranked === null) {
      return 'offline';
    }
    const declared = new Set(known.declared);
    const voided = new Set(known.voided);
    for (let tried = 0; tried < tries; tried++) {
      const id = next(day, declared, voided);
      if (id === null) {
        return 'used';
      }
      const result = await this.ranked.declare(id);
      if (result === 'failed') {
        return 'offline';
      }
      declared.add(id);
      voided.delete(id);
      this.attempts.set({
        ...known,
        declared: new Set(declared),
        voided: new Set(voided),
      });
      if (result !== 'taken') {
        return matchOf(result.uid, id, result.at);
      }
    }
    return 'used';
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
    const read = await this.ranked.declared(dayAttemptIds(day));
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

  /** The UTC day of now, which `today` then holds as well. */
  private currentDay(): string {
    const day = utcDay(new Date());
    if (day !== untracked(this.today)) {
      this.today.set(day);
    }
    return day;
  }
}

/** The declared match of an attempt: its server time and its seed. */
function matchOf(uid: string, id: string, at: number): RankedMatch {
  return { attempt: { id, at }, seed: attemptSeed(uid, id, at) };
}

function unranked(reason: UnrankedReason): RankedOutcome {
  return { match: null, note: { kind: 'unranked', reason } };
}
