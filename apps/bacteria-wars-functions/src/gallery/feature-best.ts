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
import { DAY_MS, expectedRerunMs, GALLERY_VERIFY_MS } from '../boards/budgets';
import { storedReplay } from '../boards/declared-match';
import {
  type ReplaySummary,
  type Verdict,
  verifyReplay,
} from '../boards/verify';
import {
  type AccountInfo,
  spendBudget,
  verdictFields,
} from '../boards/verify-slice';
import { dayOf } from '../limits';
import {
  type GalleryReplay,
  humansOf,
  isCandidate,
  fitsGallery,
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
export interface FeatureBestResult {
  day: string;
  skipped?: 'done';
  /** Candidates re-run now, not counting those verified before. */
  checked: number;
  published: string[];
}

/** A candidate once verified: its replay and what it scored. */
interface Scored extends Stored {
  header: ReplayHeader;
  doc: GalleryReplay & { summary: ReplaySummary };
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
  const start = Date.parse(`${day}T00:00:00Z`);
  const snapshot = await db
    .collection('replays')
    .where('state', 'in', CANDIDATE_STATES)
    .where('createdAt', '>=', Timestamp.fromMillis(start))
    .where('createdAt', '<', Timestamp.fromMillis(start + DAY_MS))
    .limit(MAX_READ)
    .get();
  // What the replay alone decides first: only its players are looked up.
  const fitting = snapshot.docs
    .map((doc) => ({ id: doc.id, doc: doc.data() as GalleryReplay }))
    .filter(({ doc }) => fitsGallery(doc));
  const uids = [...new Set(fitting.flatMap(({ doc }) => humansOf(doc) ?? []))];
  const [accounts, optedOut] = await Promise.all([
    lookUp(uids, accountInfo),
    galleryOptOuts(db, uids),
  ]);
  const ranked = rankCandidates(
    fitting.filter(({ doc }) => isCandidate(doc, accounts, optedOut, now))
  );
  let checked = 0;
  const spent = await spendBudget(
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
      const scored: Scored[] = [];
      for (const candidate of ranked) {
        const replay = await storedReplay(db, candidate.id);
        if (replay === null) {
          continue;
        }
        let { doc } = candidate;
        if (doc.state !== 'verified' || doc.summary === undefined) {
          if (expectedRerunMs(doc.ticks) > left()) {
            continue;
          }
          checked++;
          const verdict = verify(replay);
          await applyVerdict(db, candidate.id, doc.state, verdict);
          await charge();
          if (verdict.state !== 'verified' || verdict.summary === undefined) {
            continue;
          }
          doc = {
            ...doc,
            state: 'verified',
            summary: verdict.summary,
            medal: verdict.medal,
          };
        }
        const { summary } = doc;
        if (summary !== undefined) {
          scored.push({
            id: candidate.id,
            header: replay.header,
            doc: { ...doc, summary },
          });
        }
      }
      return scored;
    }
  );
  const scored = spent?.result ?? [];
  await scoreAll(db, scored);
  const published: string[] = [];
  for (const id of pickPublished(scored)) {
    const result = await publishReplay(db, id, 'auto', now);
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
        score: doc.score ?? 0,
        reasons: doc.reasons ?? [],
        hint: doc.hint,
      })),
  });
  return { day, checked, published };
}

/** The accounts behind the uids, a few at a time. */
async function lookUp(
  uids: readonly string[],
  accountInfo: (uid: string) => Promise<AccountInfo>
): Promise<Map<string, AccountInfo>> {
  const found = new Map<string, AccountInfo>();
  for (let i = 0; i < uids.length; i += 20) {
    await Promise.all(
      uids.slice(i, i + 20).map(async (uid) => {
        found.set(uid, await accountInfo(uid));
      })
    );
  }
  return found;
}

/** The players among the uids who keep their matches out of the gallery. */
async function galleryOptOuts(
  db: Firestore,
  uids: readonly string[]
): Promise<Set<string>> {
  if (uids.length === 0) {
    return new Set();
  }
  const profiles = await db.getAll(
    ...uids.map((uid) => db.doc(`profiles/${uid}`))
  );
  return new Set(
    profiles
      .filter((profile) => profile.get('galleryOptOut') === true)
      .map((profile) => profile.id)
  );
}

/** Stores a re-run's verdict on the replay, unless its state moved meanwhile. */
async function applyVerdict(
  db: Firestore,
  id: string,
  state: string,
  verdict: Verdict
): Promise<void> {
  const ref = db.doc(`replays/${id}`);
  await db.runTransaction(async (tx) => {
    if ((await tx.get(ref)).get('state') === state) {
      tx.update(ref, verdictFields(verdict));
    }
  });
}

/**
 * Scores the verified candidates from their re-run (ADR 0011) and stores
 * it on each replay. A feat is a platinum run against a hard computer or a
 * boss, and the best verified daily-level replay of the day.
 */
async function scoreAll(db: Firestore, scored: Scored[]): Promise<void> {
  const bestDaily = scored
    .filter(({ doc }) => doc.kind === 'daily')
    .sort(
      (a, b) =>
        dailySort(b.doc.winnerSeat === 0, b.doc.ticks) -
        dailySort(a.doc.winnerSeat === 0, a.doc.ticks)
    )[0];
  const batch = db.batch();
  for (const candidate of scored) {
    const { doc, header } = candidate;
    const feat =
      candidate === bestDaily ||
      (doc.medal === 'platinum' &&
        (header.difficulty === 'hard' ||
          getLevel(header.levelId).boss !== undefined));
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
    candidate.doc = { ...doc, score, reasons };
    batch.update(db.doc(`replays/${candidate.id}`), { score, reasons });
  }
  await batch.commit();
}

/**
 * The per-second sizes a summary's timeline keeps, seat by seat - every
 * second of a gallery match, which is 6 minutes at most.
 */
function samplesOf(summary: ReplaySummary): number[][] {
  const seats = Math.max(1, summary.sizes.length);
  const samples: number[][] = [];
  for (let i = 0; i + seats <= summary.timeline.length; i += seats) {
    samples.push(summary.timeline.slice(i, i + seats));
  }
  return samples;
}
