import { FieldValue, Firestore, Timestamp } from 'firebase-admin/firestore';
import type {
  MedalTier,
  Replay,
  ReplayOutcome,
  ReplayReason,
  SizeSample,
} from '@wolsok/feat-lazy-bac-game/engine';
import { Engine } from '../engine';
import { readStoredReplay } from './blob';
import { Payer, rerunCost, reserveVerification } from './budgets';
import { levelStatsId } from './derive';
import {
  isRerunState,
  mayRerun,
  ReplayDoc,
  ReplayState,
  ReplaySummary,
  RerunState,
} from './model';

/** A replay played again, and what came of it. */
export interface Rerun {
  state: RerunState;
  /** The replay as read - null when the bytes hold none. */
  replay: Replay | null;
  /** What the re-run computed; only a verified one has it. */
  summary?: ReplaySummary;
  samples?: readonly SizeSample[];
  /** The lowest own-to-enemy ratio the left seat fell to. */
  lowestRatio?: number;
  /**
   * A match against the computer: the medallion the human's run earned,
   * null for none - worked out from the re-run, never the client.
   */
  medal?: MedalTier | null;
}

/** The most per-second samples a summary keeps: 6 minutes. */
const MAX_TIMELINE = 360;

/**
 * Plays a stored replay again in Node on its ruleset's simulation - the
 * engine's `playReplay`: `BacteriaSimulation` for `cpu`, `IntSimulation`
 * for `gpu-int` (version 5, every ranked attempt; ADR 0015) - and compares
 * it with what the device recorded: the checksum, the outcome and the
 * length. A replay recorded on another balance cannot be played:
 * `balance-mismatch`. A mismatch is `unverified`, never "cheated": on
 * `cpu`, Safari's and Firefox's `Math.sin`/`hypot` may round differently
 * from V8 (ADR 0009) - and inputs crafted against V8 pass, as does a
 * scripted run.
 *
 * The re-run stops at the claimed end tick, so refuting a fake costs no
 * more than its claimed length. Null - stored bytes that hold no replay -
 * is `unverified`.
 */
export function rerunReplay(engine: Engine, replay: Replay | null): Rerun {
  if (replay === null) {
    return { state: 'unverified', replay: null };
  }
  const { header } = replay;
  if (header.balanceVersion !== engine.BALANCE_VERSION) {
    return { state: 'balance-mismatch', replay };
  }
  const played = engine.playReplay(replay);
  if (played === null) {
    return { state: 'unverified', replay };
  }
  const outcome =
    engine.replayOutcome(played.outcome) ?? stoppedOutcome(replay);
  const same =
    played.checksum === header.checksum &&
    played.ticks === header.ticks &&
    outcome !== null &&
    outcome.endedBy === header.outcome?.endedBy &&
    outcome.winnerSeat === header.outcome?.winnerSeat;
  if (!same || outcome === null) {
    return { state: 'unverified', replay };
  }
  return {
    state: 'verified',
    replay,
    ...(header.mode === 'vs-computer'
      ? { medal: medalOf(engine, replay, played, outcome) }
      : {}),
    samples: played.samples,
    lowestRatio: played.players[0]?.lowestSizeRatio ?? 1,
    summary: {
      sizes: played.players.slice(0, 2).map((player) => player.bacteriaCount),
      endedBy: outcome.endedBy,
      winnerSeat: outcome.winnerSeat,
      ticks: played.ticks,
      timeline: timeline(played.samples),
    },
  };
}

/**
 * The medallion of a re-run match against the computer, judged like the
 * result screen judges it (ADR 0016: the level statistics count them).
 */
function medalOf(
  engine: Engine,
  replay: Replay,
  played: NonNullable<ReturnType<Engine['playReplay']>>,
  outcome: ReplayOutcome
): MedalTier | null {
  const { header } = replay;
  const record = engine.matchRecord(played.players, {
    levelId: header.levelId,
    difficulty: header.difficulty,
    durationSec: Math.floor(played.ticks / engine.TICKS_PER_SEC),
    winner:
      outcome.winnerSeat === null
        ? null
        : (played.players[outcome.winnerSeat] ?? null),
    // Only the peak share reads it, which no medallion asks for.
    capacity: 0,
  });
  return record === null
    ? null
    : engine.medalFor(engine.getLevel(header.levelId).medal, record);
}

/**
 * How a match ended that the simulation did not end: a player gave up, or
 * the devices fell out of step. The engine plays to the recorded last tick
 * and stops without an outcome; the recording's own then stands, once the
 * checksum and the length agree. Null for any other ending.
 */
function stoppedOutcome(replay: Replay): ReplayOutcome | null {
  const recorded = replay.header.outcome;
  return recorded !== undefined &&
    (recorded.endedBy === 'forfeit' || recorded.endedBy === 'desync')
    ? recorded
    : null;
}

/** The samples as two lists, thinned evenly to at most {@link MAX_TIMELINE}. */
export function timeline(samples: readonly SizeSample[]): {
  left: number[];
  right: number[];
} {
  const step = Math.max(1, Math.ceil(samples.length / MAX_TIMELINE));
  const kept = samples.filter((_, index) => index % step === 0);
  return {
    left: kept.map((sample) => sample[0] ?? 0),
    right: kept.map((sample) => sample[1] ?? 0),
  };
}

/** What makes a verified replay's score - see `replayScore`. */
export interface ScoreContext {
  online: boolean;
  feat: boolean;
}

/**
 * The score of a verified re-run, from the samples the server computed -
 * never the client's hint.
 */
export function scoreOf(
  engine: Engine,
  rerun: Rerun,
  context: ScoreContext
): { score: number; reasons: ReplayReason[] } {
  if (
    rerun.state !== 'verified' ||
    rerun.summary === undefined ||
    rerun.samples === undefined
  ) {
    return { score: 0, reasons: [] };
  }
  return engine.replayScore({
    samples: rerun.samples,
    outcome: {
      endedBy: rerun.summary.endedBy,
      winnerSeat: rerun.summary.winnerSeat,
    },
    ticks: rerun.summary.ticks,
    online: context.online,
    feat: context.feat,
  });
}

/**
 * True for a feat of a match against the computer: a platinum-like run -
 * the player won and never fell below half the computer's size - on hard or
 * against a boss. (The best verified daily replay of the day is a feat as
 * well; the gallery decides that among its candidates.)
 */
export function isFeat(
  engine: Engine,
  doc: Pick<ReplayDoc, 'kind' | 'levelId' | 'difficulty' | 'winnerSeat'>,
  rerun: Rerun
): boolean {
  if (doc.kind === 'online' || doc.winnerSeat !== 0) {
    return false;
  }
  const hard =
    doc.difficulty === 'hard' || engine.getLevel(doc.levelId).boss != null;
  return hard && (rerun.lowestRatio ?? 0) >= 0.5;
}

/** Why a replay could not be re-run now. */
export type NoRerun =
  | 'no-replay'
  | 'no-blob'
  | 'no-budget'
  /** Longer than the caller re-runs - however much budget is left. */
  | 'too-long'
  /** An online match with one report: the second decides agreed or disputed. */
  | 'waiting'
  | 'changed';

/**
 * Re-runs `replays/{id}` and stores what came of it: the state and, when
 * verified, the summary, score and reasons. Stored in a transaction that
 * first checks the state is still the one the re-run started from, so two
 * callers never overwrite each other. A replay the boards or the gallery
 * decided already is not re-run again, and an online match still waiting
 * for its second report is not re-run yet. The budget is reserved only
 * once the bytes are there to re-run: `pay` picks the pool for the
 * re-run's cost (`rerunCost`) and is charged once it is reserved.
 */
export async function verifyStored(
  db: Firestore,
  engine: Engine,
  replayId: string,
  pay: Payer,
  maxTicks: number,
  feat: (doc: ReplayDoc, rerun: Rerun) => boolean = (doc, rerun) =>
    isFeat(engine, doc, rerun),
  now = Date.now()
): Promise<{ state: ReplayState; doc: ReplayDoc; rerun?: Rerun } | NoRerun> {
  const ref = db.doc(`replays/${replayId}`);
  const before = await ref.get();
  if (!before.exists) {
    return 'no-replay';
  }
  const doc = before.data() as ReplayDoc;
  if (isRerunState(doc.state)) {
    return { state: doc.state, doc };
  }
  if (!mayRerun(doc)) {
    return 'waiting';
  }
  if (doc.ticks > maxTicks) {
    return 'too-long';
  }
  const replay = await readStoredReplay(db, engine, replayId);
  if (replay === undefined) {
    return 'no-blob';
  }
  const cost = rerunCost(engine, doc.levelId, doc.ticks);
  const pool = pay.pool(cost);
  if (
    pool === null ||
    !(await reserveVerification(db, engine, pool, cost, now))
  ) {
    return 'no-budget';
  }
  pay.charge(pool, cost);
  const rerun = rerunReplay(engine, replay);
  const { score, reasons } = scoreOf(engine, rerun, {
    online: doc.kind === 'online',
    feat: rerun.state === 'verified' && feat(doc, rerun),
  });
  const update: Partial<ReplayDoc> = {
    state: rerun.state,
    verifiedAt: Timestamp.fromMillis(now),
    ...(rerun.state === 'verified'
      ? { summary: rerun.summary, score, reasons }
      : {}),
  };
  const written = await db.runTransaction(async (tx) => {
    const current = await tx.get(ref);
    if (current.get('state') !== doc.state) {
      return false;
    }
    tx.update(ref, update);
    if (rerun.state === 'verified' && rerun.medal !== undefined) {
      // ADR 0016: the medallions of the matches re-run, per level - counted
      // once, with the state change; no uid.
      tx.set(
        db.doc(`levelStats/${levelStatsId(doc, doc.kind)}`),
        {
          levelId: doc.levelId,
          difficulty: doc.difficulty,
          rerun: FieldValue.increment(1),
          ...(rerun.medal === null
            ? {}
            : { medals: { [rerun.medal]: FieldValue.increment(1) } }),
        },
        { merge: true }
      );
    }
    return true;
  });
  return written
    ? { state: rerun.state, doc: { ...doc, ...update }, rerun }
    : 'changed';
}
