import type { Firestore } from 'firebase-admin/firestore';
import type { AccountLookup } from '../accounts';
import type { Engine } from '../engine';
import { isRerunState, ReplayDoc } from '../replays/model';
import { HOUR_MS } from '../time';
import { countOnline } from './rank-online';
import { acceptRanked } from './ranked';
import { applyRerun } from './verification';

/**
 * How long `rankReplay` retries an event (ADR 0012). Its handlers are
 * idempotent, so a retry after a failed transaction takes a stored replay
 * in late instead of never; an event older than this is dropped, so a
 * poison event cannot retry forever. Well inside the 2 hours after which
 * a declared endless match without a ranked replay closes as a lost life.
 */
export const RETRY_FOR_MS = HOUR_MS;

/** True for an event `rankReplay` no longer retries - see {@link RETRY_FOR_MS}. */
export function tooOldToRetry(eventTime: string, now: number): boolean {
  return now - Date.parse(eventTime) > RETRY_FOR_MS;
}

/** True when a write to a replay is one `rankReplay` acts on. */
export function touchesRanking(
  before: Pick<ReplayDoc, 'state' | 'players'> | undefined,
  after: Pick<ReplayDoc, 'state' | 'players'> | undefined
): boolean {
  return (
    after !== undefined &&
    (before === undefined ||
      before.state !== after.state ||
      before.players.join() !== after.players.join())
  );
}

/** What `rankReplay` did. */
export type RankReplayResult =
  | 'unchanged'
  | 'online'
  | 'ranked'
  | 'rerun'
  | 'nothing';

/**
 * `rankReplay` (ADR 0012), on writes to `replays/{id}`: returns at once
 * unless the state or the players changed. An online match that turns
 * `agreed` is counted; a stored replay of a declared attempt is checked and
 * taken into its day or run; a re-run's result updates the entry.
 *
 * Retried on failure, so every step is idempotent: `countOnline` creates
 * a marker, `acceptRanked` finds the replay taken (`done`) or the attempt
 * used, and `applyRerun` leaves an attempt already decided.
 */
export async function rankReplay(
  db: Firestore,
  engine: Engine,
  accounts: AccountLookup,
  replayId: string,
  before: ReplayDoc | undefined,
  after: ReplayDoc | undefined,
  now = Date.now()
): Promise<RankReplayResult> {
  if (after === undefined || !touchesRanking(before, after)) {
    return 'unchanged';
  }
  if (after.kind === 'online') {
    if (after.state === 'agreed' && before?.state !== 'agreed') {
      await countOnline(db, engine, accounts, replayId, after, now);
      return 'online';
    }
    return 'nothing';
  }
  if (after.attempt === undefined) {
    return 'nothing';
  }
  if (before === undefined) {
    await acceptRanked(db, engine, replayId, after, now);
    return 'ranked';
  }
  if (isRerunState(after.state) && before.state !== after.state) {
    await applyRerun(db, engine, replayId, after, now);
    return 'rerun';
  }
  return 'nothing';
}
