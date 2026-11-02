import {
  BALANCE_VERSION,
  type Replay,
} from '@wolsok/feat-lazy-bac-game/engine';
import { type Firestore, Timestamp } from 'firebase-admin/firestore';
import {
  DAILY_VERIFY_MS,
  ENDLESS_VERIFY_MS,
  expectedRerunMs,
  RANKED_CELLS,
  MAX_VERIFIED_TICKS,
} from './budgets';
import { countRerun } from '../replays/level-stats';
import { storedReplay } from './declared-match';
import { winsOf } from './endless-run';
import { applyVerdict, type StoredRun } from './rank-endless';
import { type Verdict, verifyReplay } from './verify';
import { type AccountInfo, candidates, spendBudget } from './verify-slice';

/**
 * Spends what is left of the hour's slice on the `endless` board (ADR
 * 0012), from the same trust-ordered candidates: each candidate's best run
 * has its wins played again one by one, in order, from the first not yet
 * confirmed. A failed win cuts the run to its verified prefix ("partly
 * confirmed"). Runs the owner had checked (`board.verify`) go first. A
 * win longer than 10 minutes, or of another balance table,
 * is never re-run, and the run stays provisional. The day's endless budget
 * is its own plus what the daily boards left. As on the daily boards, a
 * re-run starts only when its expected cost fits, and is charged as it
 * ends.
 */
export async function verifyEndlessSlice(
  db: Firestore,
  now: number,
  accountInfo: (uid: string) => Promise<AccountInfo>,
  sliceMs: number,
  clock: () => number = () => performance.now(),
  verify: (replay: Replay) => Verdict = (replay) => verifyReplay(replay, clock)
): Promise<{ checked: number; spentMs: number }> {
  const spent = await spendBudget(
    db,
    now,
    {
      fields: ['verifyMs', 'endlessVerifyMs'],
      dayMs: DAILY_VERIFY_MS + ENDLESS_VERIFY_MS,
      capMs: sliceMs,
      field: 'endlessVerifyMs',
    },
    clock,
    async (left, charge) => {
      const [queued, found] = await Promise.all([
        queuedUids(db, now),
        candidates(db, now, accountInfo, 'endless', [{ boardId: 'endless' }]),
      ]);
      let checked = 0;
      for (const uid of new Set([...queued, ...found.map((c) => c.uid)])) {
        const run = await bestRunOf(db, uid);
        if (run !== null) {
          checked += (await verifyRunWins(db, run, left, verify, now, charge))
            .checked;
        }
        if (left() <= 0) {
          break;
        }
      }
      return checked;
    }
  );
  return { checked: spent?.result ?? 0, spentMs: spent?.spentMs ?? 0 };
}

/** At most this many runs the owner had checked go first in a slice. */
const QUEUE_SCAN = 20;

/**
 * The players whose run the owner had checked (`board.verify`) with wins
 * left: `moderation/{uid}.endlessFirstUntil` still ahead. Their runs go
 * first, wherever they stand on the board.
 */
async function queuedUids(db: Firestore, now: number): Promise<string[]> {
  const queued = await db
    .collection('moderation')
    .where('endlessFirstUntil', '>', Timestamp.fromMillis(now))
    .limit(QUEUE_SCAN)
    .get();
  return queued.docs.map((doc) => doc.id);
}

/**
 * Plays a run's wins again one by one, in order, from the first not yet
 * confirmed, while the next one's expected cost fits in `left()`: a failed
 * win cuts the run to its verified prefix, a balance mismatch stops (it
 * changes nothing, and would only be played again). Returns how many it
 * played and the run as they left it.
 */
export async function verifyRunWins(
  db: Firestore,
  start: StoredRun,
  left: () => number,
  verify: (replay: Replay) => Verdict,
  now: number,
  charge: () => Promise<void>
): Promise<{ checked: number; run: StoredRun | null }> {
  let run: StoredRun | null = start;
  let checked = 0;
  while (run !== null) {
    const next = nextWin(run);
    if (next === null || expectedRerunMs(next.ticks, RANKED_CELLS) > left()) {
      break;
    }
    const replay = await storedReplay(db, next.replayId);
    const verdict: Verdict =
      replay === null ? { state: 'unverified', ms: 0 } : verify(replay);
    checked++;
    run = await applyVerdict(
      db,
      run.uid,
      run.runId,
      next.replayId,
      verdict,
      now
    );
    // Null: another check applied it (and counted it), or the run was cut.
    if (run !== null && replay !== null) {
      await countRerun(db, replay.header, 'endless', verdict);
    }
    await charge();
    if (verdict.state === 'balance-mismatch') {
      break;
    }
  }
  return { checked, run };
}

/** The run a player's `endless` entry shows, null when there is none. */
export async function bestRunOf(
  db: Firestore,
  uid: string
): Promise<StoredRun | null> {
  const runId = (await db.doc(`boardMembers/${uid}`).get()).get(
    'endless.runId'
  );
  if (typeof runId !== 'string') {
    return null;
  }
  const run = (await db.doc(`endlessRuns/${uid}_${runId}`).get()).data();
  return (run as StoredRun | undefined) ?? null;
}

/**
 * The replay of a run's first unconfirmed win and its length - null when
 * every win is confirmed, the run was cut, or the win can never be re-run.
 */
export function nextWin(
  run: StoredRun
): { replayId: string; ticks: number } | null {
  if ((run.cut ?? null) !== null) {
    return null;
  }
  const next = winsOf(run)[run.verifiedWins ?? 0];
  return next?.replayId === undefined ||
    next.ticks === undefined ||
    next.ticks > MAX_VERIFIED_TICKS ||
    next.balanceVersion !== BALANCE_VERSION
    ? null
    : { replayId: next.replayId, ticks: next.ticks };
}
