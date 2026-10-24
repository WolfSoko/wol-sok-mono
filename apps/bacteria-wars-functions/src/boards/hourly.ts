import { Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { Moderation, unbanPlayer } from '../admin/bans';
import { writeAudit } from '../admin/records';
import { writeStats } from '../admin/stats';
import type { ReplayDoc } from '../replays/model';
import { DAY_MS, dayOf, HOUR_MS, MINUTE_MS } from '../time';
import { closeWaiting } from './rank-online';
import { updateEndlessRun } from './ranked';
import {
  dailyFinalAt,
  hourSlice,
  SliceResult,
  verifyBoardsSlice,
} from './verification';

/**
 * The steps of the `hourly` function (ADR 0012), each a plain function the
 * specs run against the emulator - the emulator fires no schedules, and an
 * HTTP export could not be kept out of production reliably.
 */

/** How long the verification slice may run, from the start of the hour's run. */
export const VERIFY_UNTIL_MS = 25 * MINUTE_MS;
/** An online replay still `waiting` this long after it was stored is closed. */
export const WAITING_CLOSE_MS = 2 * HOUR_MS;
/** How far back closing looks, in case an hour's run was missed. */
const WAITING_LOOKBACK_MS = 26 * HOUR_MS;
/** Documents one step handles per run at most. */
const STEP_LIMIT = 500;

/**
 * Cleans up bans whose `until` has passed - they ended by themselves where
 * checked - as an unban with a system audit entry.
 */
export async function expireBans(
  moderation: Moderation,
  now = Date.now()
): Promise<number> {
  const { db } = moderation;
  const ended = await db
    .collection('bans')
    .where('until', '<=', Timestamp.fromMillis(now))
    .limit(STEP_LIMIT)
    .get();
  for (const ban of ended.docs) {
    const before = await unbanPlayer(moderation, ban.id, now);
    await writeAudit(
      db,
      `expired_${ban.id}_${now}`,
      {
        by: 'system',
        type: 'player.unban',
        target: { uid: ban.id },
        reason: 'the ban ended',
        before,
        after: null,
        ok: true,
        source: 'system',
      },
      now
    );
  }
  return ended.size;
}

/**
 * Closes the declared endless matches without a replay 2 hours after
 * their declaration as lost lives (a pending submission keeps one open),
 * by recomputing the runs that have one due.
 */
export async function closeAttempts(
  moderation: Moderation,
  now = Date.now()
): Promise<number> {
  const { db, engine } = moderation;
  const due = await db
    .collection('endlessRuns')
    .where('nextCloseAt', '<=', Timestamp.fromMillis(now))
    .limit(STEP_LIMIT)
    .get();
  for (const run of due.docs) {
    await updateEndlessRun(
      db,
      engine,
      run.get('uid') as string,
      run.get('runId') as string,
      now
    );
  }
  return due.size;
}

/**
 * Closes the online replays still `waiting` 2 hours after they were stored:
 * "Not reported" for the player the stub names who did not report.
 */
export async function closeWaitingOnline(
  moderation: Moderation,
  now = Date.now()
): Promise<number> {
  const { db, engine } = moderation;
  const waiting = await db
    .collection('replays')
    .where('state', '==', 'waiting')
    .where('createdAt', '>=', Timestamp.fromMillis(now - WAITING_LOOKBACK_MS))
    .where('createdAt', '<=', Timestamp.fromMillis(now - WAITING_CLOSE_MS))
    .limit(STEP_LIMIT)
    .get();
  let notReported = 0;
  for (const replay of waiting.docs) {
    const missing = await closeWaiting(
      db,
      engine,
      replay.id,
      replay.data() as ReplayDoc,
      now
    );
    notReported += missing === null ? 0 : 1;
  }
  return notReported;
}

/**
 * Marks the daily boards whose checking ended (23:00 UTC the next day)
 * `final`. Entries still provisional stay marked as such.
 */
export async function finaliseDailyBoards(
  moderation: Moderation,
  now = Date.now()
): Promise<string[]> {
  const { db, engine } = moderation;
  const finalised: string[] = [];
  for (let back = 1; back <= 3; back++) {
    const day = dayOf(now - back * DAY_MS);
    if (now < dailyFinalAt(engine, day)) {
      continue;
    }
    const ref = db.doc(`boards/${engine.dailyBoardId(day)}`);
    const top = await ref.get();
    if (top.exists && top.get('final') !== true) {
      await ref.update({ final: true, updatedAt: Timestamp.fromMillis(now) });
      finalised.push(day);
    }
  }
  return finalised;
}

/** What one `hourly` run did. */
export interface HourlyResult {
  bansEnded: number;
  runsClosed: number;
  notReported: number;
  finalised: string[];
  verification: SliceResult;
}

/**
 * The hourly run, in order: ended bans, attempts without replays, online
 * replays waiting for 2 hours, final daily boards, the statistics
 * snapshot, then the hour's verification slice until 25 minutes passed.
 * A failing step is logged and the next one runs.
 */
export async function runHourly(
  moderation: Moderation,
  startedAt = Date.now(),
  now = startedAt
): Promise<HourlyResult> {
  const { db, engine, accounts, presence } = moderation;
  const step = async <T>(name: string, run: () => Promise<T>, empty: T) => {
    try {
      return await run();
    } catch (error) {
      logger.error(`hourly: ${name} failed`, error);
      return empty;
    }
  };
  const result: HourlyResult = {
    bansEnded: await step('bans', () => expireBans(moderation, now), 0),
    runsClosed: await step('attempts', () => closeAttempts(moderation, now), 0),
    notReported: await step(
      'not reported',
      () => closeWaitingOnline(moderation, now),
      0
    ),
    finalised: await step(
      'final boards',
      () => finaliseDailyBoards(moderation, now),
      [] as string[]
    ),
    verification: { checked: 0, verified: 0, failed: 0 },
  };
  await step(
    'statistics',
    () => writeStats(db, engine, presence, now, true),
    null
  );
  result.verification = await step(
    'verification',
    async () =>
      verifyBoardsSlice(
        db,
        engine,
        accounts,
        await hourSlice(db, now, startedAt + VERIFY_UNTIL_MS),
        now
      ),
    result.verification
  );
  return result;
}
