import { type Replay } from '@wolsok/feat-lazy-bac-game/engine';
import {
  FieldValue,
  type Firestore,
  Timestamp,
} from 'firebase-admin/firestore';
import { dayOf } from '../limits';
import {
  DAILY_VERIFY_MS,
  ENDLESS_VERIFY_MS,
  MAX_VERIFIED_TICKS,
} from './budgets';
import { winsOf } from './endless-run';
import { refreshRun, type StoredRun } from './rank-endless';
import { type Verdict, verifyReplay } from './verify';
import {
  type AccountInfo,
  type Candidate,
  candidates,
  recordCheck,
  storedReplay,
  verdictFields,
} from './verify-slice';

const DAY_MS = 24 * 3_600_000;

/**
 * Spends what is left of the hour's slice on the `endless` board (ADR
 * 0012), from the same trust-ordered candidates: each candidate's best run
 * has its wins played again one by one, in order, from the first not yet
 * confirmed. A failed win cuts the run to its verified prefix ("partly
 * confirmed"); a win longer than 10 minutes is never re-run, and the run
 * stays provisional. The day's endless budget is its own plus what the
 * daily boards left.
 */
export async function verifyEndlessSlice(
  db: Firestore,
  now: number,
  accountInfo: (uid: string) => Promise<AccountInfo>,
  sliceMs: number,
  clock: () => number = () => performance.now(),
  verify: (replay: Replay) => Verdict = (replay) => verifyReplay(replay, clock)
): Promise<{ checked: number; spentMs: number }> {
  const counterRef = db.doc(`counters/${dayOf(now)}`);
  const counter = (await counterRef.get()).data() ?? {};
  const spentToday =
    Number(counter['verifyMs'] ?? 0) + Number(counter['endlessVerifyMs'] ?? 0);
  const budget = Math.min(
    sliceMs,
    DAILY_VERIFY_MS + ENDLESS_VERIFY_MS - spentToday
  );
  if (budget <= 0) {
    return { checked: 0, spentMs: 0 };
  }
  const start = clock();
  const spent = () => clock() - start;
  let checked = 0;
  const board = [{ boardId: 'endless', kind: 'endless' as const }];
  for (const candidate of await candidates(db, now, accountInfo, board)) {
    while (spent() < budget) {
      const result = await checkNextWin(db, candidate, now, verify);
      if (result === 'done') {
        break;
      }
      checked++;
      if (result === 'failed') {
        break;
      }
    }
    if (spent() >= budget) {
      break;
    }
  }
  const spentMs = Math.round(spent());
  await counterRef.set(
    {
      endlessVerifyMs: FieldValue.increment(spentMs),
      expireAt: Timestamp.fromMillis(now + 40 * DAY_MS),
    },
    { merge: true }
  );
  return { checked, spentMs };
}

/**
 * Plays the first unconfirmed win of a candidate's best run again: `done`
 * when nothing is left to check (or the win is too long to re-run).
 */
async function checkNextWin(
  db: Firestore,
  candidate: Candidate,
  now: number,
  verify: (replay: Replay) => Verdict
): Promise<'verified' | 'failed' | 'done'> {
  const runId = (await db.doc(`boardMembers/${candidate.uid}`).get()).get(
    'endless.runId'
  );
  if (typeof runId !== 'string') {
    return 'done';
  }
  const run = (
    await db.doc(`endlessRuns/${candidate.uid}_${runId}`).get()
  ).data() as StoredRun | undefined;
  if (run === undefined || (run.cut ?? null) !== null) {
    return 'done';
  }
  const verifiedWins = run.verifiedWins ?? 0;
  const next = winsOf(run)[verifiedWins];
  if (
    next?.replayId === undefined ||
    (next.ticks ?? Infinity) > MAX_VERIFIED_TICKS
  ) {
    return 'done';
  }
  const replay = await storedReplay(db, next.replayId);
  const verdict: Verdict =
    replay === null ? { state: 'unverified', ms: 0 } : verify(replay);
  const passed = verdict.state === 'verified';
  const moderationRef = db.doc(`moderation/${candidate.uid}`);
  await db.runTransaction(async (tx) => {
    const moderation = (await tx.get(moderationRef)).data() ?? {};
    tx.update(db.doc(`replays/${next.replayId}`), verdictFields(verdict));
    recordCheck(tx, moderationRef, moderation, verdict.state, now);
  });
  await refreshRun(
    db,
    candidate.uid,
    runId,
    now,
    passed ? { verifiedWins: verifiedWins + 1 } : { cut: verifiedWins }
  );
  return passed ? 'verified' : 'failed';
}
