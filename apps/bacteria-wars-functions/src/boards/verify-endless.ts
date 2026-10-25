import {
  BALANCE_VERSION,
  type Replay,
} from '@wolsok/feat-lazy-bac-game/engine';
import type { Firestore } from 'firebase-admin/firestore';
import {
  DAILY_VERIFY_MS,
  ENDLESS_VERIFY_MS,
  expectedRerunMs,
  MAX_VERIFIED_TICKS,
} from './budgets';
import { storedReplay } from './declared-match';
import { winsOf } from './endless-run';
import { applyVerdict, type StoredRun } from './rank-endless';
import { type Verdict, verifyReplay } from './verify';
import {
  type AccountInfo,
  candidates,
  chargeAsYouGo,
  sliceBudget,
} from './verify-slice';

/**
 * Spends what is left of the hour's slice on the `endless` board (ADR
 * 0012), from the same trust-ordered candidates: each candidate's best run
 * has its wins played again one by one, in order, from the first not yet
 * confirmed. A failed win cuts the run to its verified prefix ("partly
 * confirmed"). A win longer than 10 minutes, or of another balance table,
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
  const budget = await sliceBudget(
    db,
    now,
    ['verifyMs', 'endlessVerifyMs'],
    DAILY_VERIFY_MS + ENDLESS_VERIFY_MS,
    sliceMs
  );
  if (budget <= 0) {
    return { checked: 0, spentMs: 0 };
  }
  const start = clock();
  const charge = chargeAsYouGo(db, now, 'endlessVerifyMs', clock);
  let checked = 0;
  const boards = [{ boardId: 'endless' }];
  for (const candidate of await candidates(
    db,
    now,
    accountInfo,
    'endless',
    boards
  )) {
    let run = await bestRunOf(db, candidate.uid);
    while (run !== null) {
      const next = nextWin(run);
      const left = budget - (clock() - start);
      if (next === null || expectedRerunMs(next.ticks) > left) {
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
      await charge();
      if (verdict.state === 'balance-mismatch') {
        // Changes nothing: the next slice would only play it again.
        break;
      }
    }
    if (clock() - start >= budget) {
      break;
    }
  }
  await charge(true);
  return { checked, spentMs: Math.round(clock() - start) };
}

/** The run a player's `endless` entry shows, null when there is none. */
async function bestRunOf(
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
function nextWin(run: StoredRun): { replayId: string; ticks: number } | null {
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
