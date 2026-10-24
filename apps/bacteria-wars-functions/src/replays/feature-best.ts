import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import type { Account, AccountLookup } from '../accounts';
import { Engine, loadEngine } from '../engine';
import { getAllChunked } from '../firestore';
import { DAY_MS, dayOf, dayStart } from '../time';
import { fixedPool, MAX_GALLERY_MINUTES, minuteTicks } from './budgets';
import type { ReplayDoc, ReplayState } from './model';
import { publishReplay, seatUids } from './publish';
import { isFeat, Rerun, scoreOf, verifyStored } from './verify';

/** Candidates the gallery re-runs a day at most (ADR 0011). */
export const MAX_CANDIDATES = 20;
/** Candidates per player at most. */
export const MAX_PER_PLAYER = 3;
/** Replays published a day at most... */
export const MAX_PUBLISHED = 10;
/** ...scoring at least this... */
export const MIN_SCORE = 60;
/** ...one per player, two per level. */
export const MAX_PER_LEVEL = 2;
/** How old an account must be for its matches to be candidates. */
export const MIN_ACCOUNT_AGE_MS = 7 * DAY_MS;
/** When `featureBest` stops re-running, inside its 1800 s timeout. */
export const TIME_BUDGET_MS = 1_500_000;
/** The day's replays it reads at most. */
const MAX_READ = 5_000;

/** A stored replay by its id. */
export interface StoredReplay {
  id: string;
  doc: ReplayDoc;
}

/** The states a candidate may be in - a replay the boards verified needs no re-run. */
const CANDIDATE_STATES: readonly ReplayState[] = [
  'submitted',
  'agreed',
  'verified',
];

/** The human seats' uids of a replay - null when a room did not name both. */
function humansOf(doc: ReplayDoc): string[] | null {
  const seats = seatUids(doc);
  return seats === null
    ? null
    : seats.filter((uid): uid is string => uid !== null);
}

/**
 * The part of {@link isCandidate} the replay alone decides, checked before
 * any account is looked up: local and submitted or online and agreed - or
 * verified already - on the current balance, at most 6 minutes long,
 * nobody took it down, a human on a seat, both named online.
 */
export function fitsGallery(
  doc: ReplayDoc,
  engine: Pick<Engine, 'BALANCE_VERSION' | 'TICKS_PER_SEC'>
): boolean {
  const stateFits =
    doc.state === 'verified' ||
    (doc.kind === 'online'
      ? doc.state === 'agreed'
      : doc.state === 'submitted');
  const humans = humansOf(doc);
  return (
    stateFits &&
    doc.balanceVersion === engine.BALANCE_VERSION &&
    doc.ticks <= minuteTicks(engine, MAX_GALLERY_MINUTES) &&
    doc.optOut.length === 0 &&
    humans !== null &&
    humans.length > 0 &&
    (doc.kind !== 'online' || doc.bound === true)
  );
}

/**
 * True for a replay the gallery may take (ADR 0011): it fits the gallery
 * ({@link fitsGallery}), its human seats are on accounts that are linked
 * and at least 7 days old, two distinct ones online, and nobody keeps
 * their matches out of the gallery.
 */
export function isCandidate(
  { doc }: StoredReplay,
  engine: Pick<Engine, 'BALANCE_VERSION' | 'TICKS_PER_SEC'>,
  accounts: ReadonlyMap<string, Account>,
  optedOut: ReadonlySet<string>,
  now: number
): boolean {
  return (
    fitsGallery(doc, engine) &&
    (humansOf(doc) ?? []).every((uid) => {
      const account = accounts.get(uid);
      return (
        account !== undefined &&
        !account.anonymous &&
        now - account.createdAt >= MIN_ACCOUNT_AGE_MS &&
        !optedOut.has(uid)
      );
    })
  );
}

/** The candidates to re-run: the best hints first, at most 3 per player and 20 in all. */
export function rankCandidates(
  candidates: readonly StoredReplay[]
): StoredReplay[] {
  const perPlayer = new Map<string, number>();
  const picked: StoredReplay[] = [];
  const byHint = [...candidates].sort(
    (a, b) => b.doc.hint - a.doc.hint || (a.id < b.id ? -1 : 1)
  );
  for (const candidate of byHint) {
    const players = candidate.doc.players;
    if (players.some((uid) => (perPlayer.get(uid) ?? 0) >= MAX_PER_PLAYER)) {
      continue;
    }
    players.forEach((uid) => perPlayer.set(uid, (perPlayer.get(uid) ?? 0) + 1));
    picked.push(candidate);
    if (picked.length >= MAX_CANDIDATES) {
      break;
    }
  }
  return picked;
}

/**
 * The verified replays to publish: scoring at least 60, online matches
 * first, then the best scores; at most ten, one per player and two per
 * level.
 */
export function pickPublished(verified: readonly StoredReplay[]): string[] {
  const perLevel = new Map<string, number>();
  const players = new Set<string>();
  const picked: string[] = [];
  const order = verified
    .filter(
      ({ doc }) => doc.state === 'verified' && (doc.score ?? 0) >= MIN_SCORE
    )
    .sort(
      (a, b) =>
        Number(b.doc.kind === 'online') - Number(a.doc.kind === 'online') ||
        (b.doc.score ?? 0) - (a.doc.score ?? 0) ||
        b.doc.hint - a.doc.hint
    );
  for (const { id, doc } of order) {
    if (
      picked.length >= MAX_PUBLISHED ||
      doc.players.some((uid) => players.has(uid)) ||
      (perLevel.get(doc.levelId) ?? 0) >= MAX_PER_LEVEL
    ) {
      continue;
    }
    doc.players.forEach((uid) => players.add(uid));
    perLevel.set(doc.levelId, (perLevel.get(doc.levelId) ?? 0) + 1);
    picked.push(id);
  }
  return picked;
}

/** What one `featureBest` run did. */
export interface FeatureBestResult {
  day: string;
  skipped?: 'done' | 'disabled';
  checked: number;
  published: string[];
}

/**
 * `featureBest` (ADR 0011, changed by ADR 0012): re-runs at most 20 of the
 * previous UTC day's best candidates within the gallery's budget and its
 * time, stores what came of each, publishes up to ten and writes the
 * runners-up to `replayCandidates/{day}` for the owner. Idempotent per day:
 * a day with its candidates written is not done again.
 */
export async function featureBest(
  db: Firestore,
  accounts: AccountLookup,
  now = Date.now(),
  startedAt = Date.now()
): Promise<FeatureBestResult> {
  const day = dayOf(now - DAY_MS);
  const marker = db.doc(`replayCandidates/${day}`);
  if ((await marker.get()).get('done') === true) {
    return { day, skipped: 'done', checked: 0, published: [] };
  }
  const engine = await loadEngine();
  const start = dayStart(day);
  const snapshot = await db
    .collection('replays')
    .where('state', 'in', CANDIDATE_STATES)
    .where('createdAt', '>=', Timestamp.fromMillis(start))
    .where('createdAt', '<', Timestamp.fromMillis(start + DAY_MS))
    .limit(MAX_READ)
    .get();
  // The filters on the replay alone first: only their players are looked up.
  const stored = snapshot.docs
    .map((doc) => ({ id: doc.id, doc: doc.data() as ReplayDoc }))
    .filter(({ doc }) => fitsGallery(doc, engine));
  const uids = [...new Set(stored.flatMap(({ doc }) => humansOf(doc) ?? []))];
  const found = await accounts(uids);
  const optedOut = await galleryOptOuts(db, uids);
  const ranked = rankCandidates(
    stored.filter((replay) => isCandidate(replay, engine, found, optedOut, now))
  );

  const verified: (StoredReplay & { rerun?: Rerun })[] = [];
  let checked = 0;
  for (const { id } of ranked) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      logger.warn('featureBest ran out of time', { day, checked });
      break;
    }
    checked++;
    const result = await verifyStored(
      db,
      engine,
      id,
      fixedPool('gallery'),
      minuteTicks(engine, MAX_GALLERY_MINUTES),
      (doc, rerun) => isFeat(engine, doc, rerun),
      now
    );
    if (typeof result === 'string') {
      logger.info('Candidate not re-run', { id, reason: result });
      if (result === 'no-budget') {
        break;
      }
      continue;
    }
    if (result.state === 'verified') {
      verified.push({ id, doc: result.doc, rerun: result.rerun });
    }
  }
  await markBestDaily(db, engine, verified);

  const published: string[] = [];
  for (const id of pickPublished(verified)) {
    const result = await publishReplay(db, engine, id, 'auto', now);
    if (typeof result === 'string') {
      logger.info('Candidate not published', { id, reason: result });
    } else {
      published.push(id);
    }
  }
  await marker.set({
    day,
    done: true,
    at: Timestamp.fromMillis(now),
    checked,
    published,
    candidates: verified
      .filter(({ id }) => !published.includes(id))
      .map(({ id, doc }) => ({
        replayId: id,
        kind: doc.kind,
        levelId: doc.levelId,
        score: doc.score ?? 0,
        reasons: doc.reasons ?? [],
        hint: doc.hint,
      })),
  });
  return { day, checked, published };
}

/** The players among `uids` who keep their matches out of the gallery. */
async function galleryOptOuts(
  db: Firestore,
  uids: readonly string[]
): Promise<Set<string>> {
  const profiles = await getAllChunked(
    db,
    uids.map((uid) => db.doc(`profiles/${uid}`))
  );
  return new Set(
    profiles
      .filter((profile) => profile.get('galleryOptOut') === true)
      .map((profile) => profile.id)
  );
}

/**
 * The best verified daily-level replay of the day is a feat (ADR 0011): its
 * score is worked out again with it.
 */
async function markBestDaily(
  db: Firestore,
  engine: Engine,
  verified: (StoredReplay & { rerun?: Rerun })[]
): Promise<void> {
  const daily = verified
    .filter(({ doc, rerun }) => doc.kind === 'daily' && rerun !== undefined)
    .sort(
      (a, b) =>
        engine.dailySort(b.doc.winnerSeat === 0, b.doc.ticks) -
        engine.dailySort(a.doc.winnerSeat === 0, a.doc.ticks)
    );
  const best = daily[0];
  if (best?.rerun === undefined || best.doc.reasons?.includes('feat')) {
    return;
  }
  const { score, reasons } = scoreOf(engine, best.rerun, {
    online: false,
    feat: true,
  });
  best.doc = { ...best.doc, score, reasons };
  await db.doc(`replays/${best.id}`).update({ score, reasons });
}
