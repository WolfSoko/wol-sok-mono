import type { Replay } from '@wolsok/feat-lazy-bac-game/engine';
import { type Firestore, Timestamp } from 'firebase-admin/firestore';
import { ADMIN_COMMAND_MS, ADMIN_VERIFY_MS, DAY_MS } from './budgets';
import type { Verdict } from './verify';
import { bestRunOf, nextWin, verifyRunWins } from './verify-endless';
import {
  chargeAsYouGo,
  checkBestAttempt,
  openDays,
  sliceBudget,
} from './verify-slice';

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
 * order, now, from the admin budget (`adminVerifyMs` in `counters/{day}`):
 * at most 10 match-minutes a command, 20 a day. What a run has left waits
 * first in line for the hourly slice for a day
 * (`moderation/{uid}.endlessFirstUntil`) - as long as the run is among the
 * candidates the slice looks at. `nothing-to-verify` for an entry with
 * nothing provisional, `closed` for a day board no longer checked,
 * `no-budget` when the day's admin budget is spent or the next match is
 * longer than what is left of it. Each command charges what it spent, a
 * check another one won too; two commands at once may overrun the day by
 * one command's share.
 */
export async function verifyNow(
  db: Firestore,
  uid: string,
  board: { kind: 'daily'; day: string } | { kind: 'endless' },
  now: number,
  clock: () => number,
  verify: (replay: Replay) => Verdict
): Promise<VerifyNow | 'nothing-to-verify' | 'closed' | 'no-budget'> {
  if (board.kind === 'daily' && !openDays(now).includes(board.day)) {
    return 'closed';
  }
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
  const result = await play(
    db,
    uid,
    board,
    now,
    verify,
    charge,
    () => budget - (clock() - start)
  );
  await charge(true);
  return typeof result === 'string'
    ? result
    : { ...result, spentMs: Math.round(clock() - start) };
}

async function play(
  db: Firestore,
  uid: string,
  board: { kind: 'daily'; day: string } | { kind: 'endless' },
  now: number,
  verify: (replay: Replay) => Verdict,
  charge: () => Promise<void>,
  left: () => number
): Promise<Omit<VerifyNow, 'spentMs'> | 'nothing-to-verify' | 'no-budget'> {
  if (board.kind === 'daily') {
    const result = await checkBestAttempt(
      db,
      uid,
      board.day,
      now,
      verify,
      left()
    );
    if (result === 'too-long') {
      return 'no-budget';
    }
    return result === 'checked'
      ? { checked: 1, queued: false }
      : 'nothing-to-verify';
  }
  const run = await bestRunOf(db, uid);
  if (run === null || nextWin(run) === null) {
    return 'nothing-to-verify';
  }
  const played = await verifyRunWins(db, run, left, verify, now, charge);
  if (played.checked === 0) {
    return 'no-budget';
  }
  const queued = played.run !== null && nextWin(played.run) !== null;
  if (queued) {
    await db
      .doc(`moderation/${uid}`)
      .set(
        { endlessFirstUntil: Timestamp.fromMillis(now + DAY_MS) },
        { merge: true }
      );
  }
  return { checked: played.checked, queued };
}
