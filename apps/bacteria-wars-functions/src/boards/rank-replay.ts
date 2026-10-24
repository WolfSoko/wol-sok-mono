import type { Firestore } from 'firebase-admin/firestore';
import type { AccountLookup } from '../accounts';
import type { Engine } from '../engine';
import type { ReplayDoc } from '../replays/model';
import { countOnline } from './rank-online';
import { acceptRanked } from './ranked';
import { applyRerun } from './verification';

/** States a re-run leaves. */
const RERUN_STATES: readonly string[] = [
  'verified',
  'unverified',
  'balance-mismatch',
];

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
  if (RERUN_STATES.includes(after.state) && before.state !== after.state) {
    await applyRerun(db, engine, replayId, after, now);
    return 'rerun';
  }
  return 'nothing';
}
