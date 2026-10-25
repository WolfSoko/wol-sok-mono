import type { Replay } from '@wolsok/feat-lazy-bac-game/engine';
import { type Firestore, Timestamp } from 'firebase-admin/firestore';
import { ADMIN_COMMAND_MS, ADMIN_VERIFY_MS, DAY_MS } from './budgets';
import type { Verdict } from './verify';
import { bestRunOf, nextWin, verifyRunWins } from './verify-endless';
import { chargeAsYouGo, checkBestAttempt, sliceBudget } from './verify-slice';

/** What `board.verify` played, for the audit. */
export interface VerifyNow {
  checked: number;
  spentMs: number;
  /** True when the rest of a run waits, first in line, for `hourly`. */
  queued: boolean;
}

/**
 * The owner's "verify now" (`board.verify`, ADR 0012): plays a daily
 * entry's best provisional attempt again, or a run's unconfirmed wins in
 * order, now, from the admin budget (`adminVerifyMs` in
 * `counters/{day}`): at most 6 match-minutes a command, 20 a day. The
 * rest of a run is queued first for the hourly slice for a day
 * (`moderation/{uid}.verifyFirstUntil`). `nothing-to-verify` for an entry
 * with nothing provisional, `no-budget` when the day's admin budget is
 * spent or the attempt is longer than what is left of it.
 */
export async function verifyNow(
  db: Firestore,
  uid: string,
  board: { kind: 'daily'; day: string } | { kind: 'endless' },
  now: number,
  clock: () => number,
  verify: (replay: Replay) => Verdict
): Promise<VerifyNow | 'nothing-to-verify' | 'no-budget'> {
  const budget = await sliceBudget(
    db,
    now,
    ['adminVerifyMs'],
    ADMIN_VERIFY_MS,
    ADMIN_COMMAND_MS
  );
  if (budget <= 0) {
    return 'no-budget';
  }
  const start = clock();
  const charge = chargeAsYouGo(db, now, 'adminVerifyMs', clock);
  const spent = async () => {
    await charge(true);
    return Math.round(clock() - start);
  };
  if (board.kind === 'daily') {
    const result = await checkBestAttempt(
      db,
      uid,
      board.day,
      now,
      verify,
      budget
    );
    if (result === 'too-long') {
      return 'no-budget';
    }
    if (result !== 'checked') {
      return 'nothing-to-verify';
    }
    return { checked: 1, spentMs: await spent(), queued: false };
  }
  const run = await bestRunOf(db, uid);
  if (run === null || nextWin(run) === null) {
    return 'nothing-to-verify';
  }
  const played = await verifyRunWins(
    db,
    run,
    () => budget - (clock() - start),
    verify,
    now,
    charge
  );
  const queued = played.run !== null && nextWin(played.run) !== null;
  if (queued) {
    await db
      .doc(`moderation/${uid}`)
      .set(
        { verifyFirstUntil: Timestamp.fromMillis(now + DAY_MS) },
        { merge: true }
      );
  }
  if (played.checked === 0 && !queued) {
    return 'nothing-to-verify';
  }
  return { checked: played.checked, spentMs: await spent(), queued };
}
