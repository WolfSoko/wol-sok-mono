import {
  dailySort,
  getLevel,
  type Replay,
  type ReplayHeader,
  type ReplayOutcome,
  replayScore,
} from '@wolsok/feat-lazy-bac-game/engine';
import { type Firestore, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/logger';
import {
  DAY_MS,
  expectedRerunMs,
  GALLERY_VERIFY_MS,
  RANKED_CELLS,
} from '../boards/budgets';
import { storedReplay } from '../boards/declared-match';
import { boardProfileOf } from '../boards/names';
import {
  type ReplaySummary,
  samplesOf,
  type Verdict,
  verifyReplay,
} from '../boards/verify';
import {
  type AccountInfo,
  spendBudget,
  verdictFields,
} from '../boards/verify-slice';
import { hasGrpcCode } from '../grpc';
import { dayOf, dayStart, isBanned } from '../limits';
import { countRerun } from '../replays/level-stats';
import {
  byHint,
  fitsGallery,
  type GalleryReplay,
  humansOf,
  isCandidate,
  MAX_CANDIDATES,
  pickPublished,
  rankCandidates,
  type Stored,
} from './candidates';
import { publishReplay } from './publish';

/** The states a candidate may be in - one the boards verified needs no re-run. */
const CANDIDATE_STATES = ['submitted', 'agreed', 'verified'];
/** The day's replays it reads at most. */
const MAX_READ = 5_000;

/** What one `featureBest` run did. */
interface FeatureBestResult {
  day: string;
  skipped?: 'done';
  /** Candidates re-run now, not counting those verified before. */
  checked: number;
  published: string[];
}

/** A verified candidate, and its header where it was read already. */
export interface Verified extends Stored {
  header?: ReplayHeader;
  doc: GalleryReplay & { summary: ReplaySummary };
}

/** A candidate once scored. */
interface Scored extends Stored {
  doc: GalleryReplay & { score: number; reasons: string[] };
}

/**
 * `featureBest` (ADR 0011, changed by ADR 0012), once a day for the UTC day
 * before: picks at most 20 candidates by the client's hint, re-runs those
 * the boards have not verified within the gallery's day budget
 * (`galleryVerifyMs`), scores the verified ones from the re-run
 * (`replayScore`, onto `replays/{id}`), publishes up to ten scoring 60 or
 * more and writes the runners-up to `replayCandidates/{day}` for the
 * owner. Idempotent per day: a day marked done is not done again.
 */
export async function featureBest(
  db: Firestore,
  now: number,
  accountInfo: (uid: string) => Promise<AccountInfo>,
  clock: () => number = () => performance.now(),
  verify: (replay: Replay) => Verdict = (replay) => verifyReplay(replay, clock)
): Promise<FeatureBestResult> {
  const day = dayOf(now - DAY_MS);
  const marker = db.doc(`replayCandidates/${day}`);
  if ((await marker.get()).get('done') === true) {
    return { day, skipped: 'done', checked: 0, published: [] };
  }
  const start = dayStart(day);
  const snapshot = await db
    .collection('replays')
    .where('state', 'in', CANDIDATE_STATES)
    .where('createdAt', '>=', Timestamp.fromMillis(start))
    .where('createdAt', '<', Timestamp.fromMillis(start + DAY_MS))
    .limit(MAX_READ)
    .get();
  if (snapshot.size === MAX_READ) {
    logger.warn('featureBest read its limit of replays', { day, MAX_READ });
  }
  // What the replay alone decides first; accounts only for the best hints.
  const fitting = snapshot.docs
    .map((doc) => ({ id: doc.id, doc: doc.data() as GalleryReplay }))
    .filter(({ doc }) => fitsGallery(doc))
    .sort(byHint);
  const ranked = await pickCandidates(db, fitting, accountInfo, now);
  const verified: Verified[] = [];
  const toRerun: Stored[] = [];
  for (const candidate of ranked) {
    // Those the boards verified need no re-run, and so no budget.
    const done = alreadyVerified(candidate);
    if (done === null) {
      toRerun.push(candidate);
    } else {
      verified.push(done);
    }
  }
  let checked = 0;
  if (toRerun.length > 0) {
    await spendBudget(
      db,
      now,
      {
        fields: ['galleryVerifyMs'],
        dayMs: GALLERY_VERIFY_MS,
        capMs: GALLERY_VERIFY_MS,
        field: 'galleryVerifyMs',
      },
      clock,
      async (left, charge) => {
        for (const candidate of toRerun) {
          const result = await rerunCandidate(
            db,
            candidate,
            left,
            charge,
            verify
          );
          if (result !== 'no-budget' && result !== 'no-blob') {
            checked++;
          }
          if (typeof result !== 'string') {
            verified.push(result);
          }
        }
      }
    );
  }
  const scored = await scoreAll(db, verified);
  // One player a published replay: they never meet in two of them. A
  // failure costs its candidate only, so the day is still marked done.
  const results = await Promise.all(
    pickPublished(scored).map(async (id) => ({
      id,
      result: await publishReplay(db, id, 'auto', now).catch(
        (error: unknown) => {
          logger.warn('Candidate failed to publish', { id, error });
          return 'failed' as const;
        }
      ),
    }))
  );
  const published: string[] = [];
  for (const { id, result } of results) {
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
    candidates: scored
      .filter(({ id }) => !published.includes(id))
      .map(({ id, doc }) => ({
        replayId: id,
        kind: doc.kind,
        levelId: doc.levelId,
        score: doc.score,
        reasons: doc.reasons,
        hint: doc.hint,
      })),
  });
  return { day, checked, published };
}

/** A candidate as verified, with what the re-run found. */
function asVerified(
  { id, doc }: Stored,
  summary: ReplaySummary,
  medal: GalleryReplay['medal']
): Verified {
  return { id, doc: { ...doc, state: 'verified', summary, medal } };
}

/** The candidate as verified where the boards verified it, else null. */
export function alreadyVerified(candidate: Stored): Verified | null {
  const { state, summary, medal } = candidate.doc;
  return state === 'verified' && summary !== undefined
    ? asVerified(candidate, summary, medal)
    : null;
}

/**
 * Re-runs a candidate if `left()` covers it, stores the verdict unless its
 * state moved meanwhile (`changed`), charges the time and counts the
 * re-run in the level statistics: the candidate verified, or why not.
 */
export async function rerunCandidate(
  db: Firestore,
  candidate: Stored,
  left: () => number,
  charge: () => Promise<void>,
  verify: (replay: Replay) => Verdict
): Promise<Verified | 'no-budget' | 'no-blob' | 'changed' | 'not-verified'> {
  const { id, doc } = candidate;
  // A replay stored before its arena was kept is on the online grid.
  if (expectedRerunMs(doc.ticks, doc.cells ?? RANKED_CELLS) > left()) {
    return 'no-budget';
  }
  const replay = await storedReplay(db, id);
  if (replay === null) {
    return 'no-blob';
  }
  const verdict = verify(replay);
  const applied = await applyVerdict(db, id, doc.state, verdict);
  await charge();
  if (!applied) {
    return 'changed';
  }
  await countRerun(db, replay.header, doc.kind, verdict);
  return verdict.state === 'verified' && verdict.summary !== undefined
    ? {
        ...asVerified(candidate, verdict.summary, verdict.medal),
        header: replay.header,
      }
    : 'not-verified';
}

/** Replays whose players are looked up at once. */
const LOOKUP_CHUNK = 40;

/**
 * The candidates (`rankCandidates`) among the fitting replays, best hints
 * first: their players' accounts, profiles and bans are looked up a chunk
 * at a time, only until 20 candidates are found. A banned player's match
 * takes no slot.
 */
async function pickCandidates(
  db: Firestore,
  fitting: readonly Stored[],
  accountInfo: (uid: string) => Promise<AccountInfo>,
  now: number
): Promise<Stored[]> {
  const accounts = new Map<string, AccountInfo>();
  const excluded = new Set<string>();
  const accepted: Stored[] = [];
  let ranked: Stored[] = [];
  for (let i = 0; i < fitting.length; i += LOOKUP_CHUNK) {
    const chunk = fitting.slice(i, i + LOOKUP_CHUNK);
    const unknown = [
      ...new Set(chunk.flatMap(({ doc }) => humansOf(doc) ?? [])),
    ].filter((uid) => !accounts.has(uid));
    const [found, optedOut, bans] = await Promise.all([
      Promise.all(
        unknown.map(async (uid) => [uid, await accountInfo(uid)] as const)
      ),
      galleryOptOuts(db, unknown),
      Promise.all(unknown.map((uid) => isBanned(db, uid, now))),
    ]);
    found.forEach(([uid, info]) => accounts.set(uid, info));
    optedOut.forEach((uid) => excluded.add(uid));
    unknown.forEach((uid, k) => bans[k] && excluded.add(uid));
    accepted.push(
      ...chunk.filter(({ doc }) => isCandidate(doc, accounts, excluded, now))
    );
    ranked = rankCandidates(accepted);
    if (ranked.length >= MAX_CANDIDATES) {
      break;
    }
  }
  return ranked;
}

/** The players among the uids who keep their matches out of the gallery. */
async function galleryOptOuts(
  db: Firestore,
  uids: readonly string[]
): Promise<string[]> {
  if (uids.length === 0) {
    return [];
  }
  const profiles = await db.getAll(
    ...uids.map((uid) => db.doc(`profiles/${uid}`))
  );
  return profiles
    .filter((profile) => boardProfileOf(profile.data()).galleryOptOut)
    .map((profile) => profile.id);
}

/**
 * Stores a re-run's verdict on the replay, unless its state moved meanwhile
 * - true when it did.
 */
async function applyVerdict(
  db: Firestore,
  id: string,
  state: string,
  verdict: Verdict
): Promise<boolean> {
  const ref = db.doc(`replays/${id}`);
  return db.runTransaction(async (tx) => {
    if ((await tx.get(ref)).get('state') !== state) {
      return false;
    }
    tx.update(ref, verdictFields(verdict));
    return true;
  });
}

/**
 * Scores the verified candidates (`storeScore`); the best verified
 * daily-level replay of the day is a feat.
 */
function scoreAll(db: Firestore, verified: Verified[]): Promise<Scored[]> {
  const bestDaily = verified
    .filter(({ doc }) => doc.kind === 'daily')
    .sort(
      (a, b) =>
        dailySort(b.doc.winnerSeat === 0, b.doc.ticks) -
        dailySort(a.doc.winnerSeat === 0, a.doc.ticks)
    )[0];
  return Promise.all(
    verified.map((candidate) =>
      storeScore(db, candidate, candidate === bestDaily)
    )
  );
}

/**
 * Scores a verified replay from its re-run (ADR 0011) and stores it on the
 * replay. A feat is `bestDaily`, or a platinum run against a hard computer
 * or a boss. A replay deleted meanwhile (its account went) is just not
 * stored.
 */
export async function storeScore(
  db: Firestore,
  candidate: Verified,
  bestDaily: boolean
): Promise<Scored> {
  const { doc } = candidate;
  const feat =
    bestDaily ||
    (doc.medal === 'platinum' && (await againstTheStrongest(db, candidate)));
  const { score, reasons } = replayScore({
    samples: samplesOf(doc.summary),
    outcome: {
      endedBy: doc.summary.endedBy as ReplayOutcome['endedBy'],
      winnerSeat: doc.summary.winnerSeat,
    },
    ticks: doc.ticks,
    online: doc.kind === 'online',
    feat,
  });
  await db
    .doc(`replays/${candidate.id}`)
    .update({ score, reasons })
    .catch((error: unknown) => {
      if (!hasGrpcCode(error, 5, 'not-found')) {
        throw error;
      }
    });
  return { id: candidate.id, doc: { ...doc, score, reasons } };
}

/**
 * True for a match against a hard computer or a boss - the header read
 * only for a platinum run the boards verified.
 */
async function againstTheStrongest(
  db: Firestore,
  { id, header }: Verified
): Promise<boolean> {
  const played = header ?? (await storedReplay(db, id))?.header;
  return (
    played !== undefined &&
    (played.difficulty === 'hard' ||
      getLevel(played.levelId).boss !== undefined)
  );
}
