import { PUBLIC_ID } from '@wolsok/feat-lazy-bac-game/engine';
import {
  type DocumentSnapshot,
  FieldPath,
  type Firestore,
  type Query,
  Timestamp,
} from 'firebase-admin/firestore';
import {
  type CardView,
  galleryPage,
  replayPage,
  type ReplayView,
  sitemap,
  statusPage,
} from './render';
import type { Lang } from './texts';

/** What `publicSite` answers. */
export interface SiteResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

/** The replays the gallery page shows at most. */
const GALLERY_SIZE = 60;
/** The replays the sitemap lists at most: a sitemap's limit. */
const SITEMAP_SIZE = 50_000;

/**
 * Hosting's CDN keeps a page two minutes and a browser one more, so a
 * takedown can take up to three minutes to show everywhere (ADR 0011).
 * `firebase.bacteria-game-remote.json` sets the same for `/replays`, as
 * its catch-all `no-cache` header may otherwise win (`hosting.spec.ts`).
 */
export const CACHE = 'public, max-age=60, s-maxage=120';
/** The sitemap changes once a day: an hour, so a miss is rare. */
export const SITEMAP_CACHE = 'public, max-age=3600, s-maxage=3600';
/** The fields a gallery card shows - not the summary's timeline. */
const CARD_FIELDS = [
  'levelId',
  'kind',
  'players',
  'ticks',
  'winnerSeat',
  'score',
  'reasons',
  'featuredAt',
];

/**
 * `publicSite` (ADR 0011), behind Hosting's rewrites of `/replays` and
 * `/replays/**`: the gallery (`/replays`, `/replays/index.json`), one
 * replay (`/replays/{id}`, `/replays/{id}/replay.json` for the viewer) and
 * the replays' sitemap (`/replays/sitemap.xml`). The gallery pages back
 * with `?before={ms}_{id}`, so every replay still up is linked, and the
 * sitemap lists them all. It reads `publicReplays` only: a private id
 * answers 404 like an unknown one, a removed replay 410. `?lang=de` for
 * German, English otherwise.
 */
export async function handleSite(
  db: Firestore,
  method: string,
  path: string,
  query: Readonly<Record<string, unknown>>
): Promise<SiteResponse> {
  if (method !== 'GET' && method !== 'HEAD') {
    return { status: 405, headers: { Allow: 'GET, HEAD' }, body: '' };
  }
  const lang: Lang = query['lang'] === 'de' ? 'de' : 'en';
  const parts = path.replace(/\/+$/, '').split('/').slice(1);
  if (parts[0] !== 'replays' || parts.length > 3) {
    return notFound(lang);
  }
  const [, id, file] = parts;
  if (id === undefined || (id === 'index.json' && file === undefined)) {
    const { views, older } = await galleryOf(db, query['before']);
    return id === undefined
      ? html(200, galleryPage(lang, views, older))
      : json(200, { replays: views, ...(older === null ? {} : { older }) });
  }
  if (id === 'sitemap.xml' && file === undefined) {
    const listed = await stillUp(db)
      .select('featuredAt')
      .limit(SITEMAP_SIZE)
      .get();
    return {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': SITEMAP_CACHE,
      },
      body: sitemap(
        listed.docs.map((doc) => ({ id: doc.id, featuredAt: millisOf(doc) }))
      ),
    };
  }
  if (!PUBLIC_ID.test(id) || (file !== undefined && file !== 'replay.json')) {
    return notFound(lang);
  }
  const doc = await db.doc(`publicReplays/${id}`).get();
  if (!doc.exists) {
    return notFound(lang);
  }
  const removedAt: unknown = doc.get('removedAt');
  if (removedAt !== null && removedAt !== undefined) {
    return gone(lang, file !== undefined);
  }
  if (file === undefined) {
    return html(200, replayPage(lang, replayOf(doc)));
  }
  const blob = await doc.ref.collection('blob').doc('data').get();
  const bytes: unknown = blob.get('bytes');
  if (!(bytes instanceof Uint8Array)) {
    return gone(lang, true);
  }
  return json(200, { bytes: Buffer.from(bytes).toString('base64') });
}

/** The public replays still up, newest first - a day's share a time. */
function stillUp(db: Firestore): Query {
  return db
    .collection('publicReplays')
    .where('removedAt', '==', null)
    .orderBy('featuredAt', 'desc')
    .orderBy(FieldPath.documentId(), 'desc');
}

/**
 * A page of the gallery: the replays before the `before` cursor
 * (`{ms}_{id}`, the last card of the page before), and the cursor of the
 * next page, null on the last.
 */
async function galleryOf(
  db: Firestore,
  before: unknown
): Promise<{ views: CardView[]; older: string | null }> {
  let query = stillUp(db).select(...CARD_FIELDS);
  const cursor =
    typeof before === 'string'
      ? /^(\d+)_([A-Za-z0-9]{20})$/.exec(before)
      : null;
  if (cursor !== null) {
    query = query.startAfter(
      Timestamp.fromMillis(Number(cursor[1])),
      cursor[2]
    );
  }
  const snapshot = await query.limit(GALLERY_SIZE + 1).get();
  const views = snapshot.docs.slice(0, GALLERY_SIZE).map(cardOf);
  const last = views.at(-1);
  return {
    views,
    older:
      snapshot.size > GALLERY_SIZE && last !== undefined
        ? `${last.featuredAt}_${last.id}`
        : null,
  };
}

/** When a public replay was featured, in ms. */
function millisOf(doc: DocumentSnapshot): number {
  const featuredAt: unknown = doc.get('featuredAt');
  return featuredAt instanceof Timestamp ? featuredAt.toMillis() : 0;
}

/** A public replay as a gallery card shows it. */
function cardOf(doc: DocumentSnapshot): CardView {
  const data = doc.data() ?? {};
  return {
    id: doc.id,
    levelId: String(data['levelId'] ?? ''),
    kind: String(data['kind'] ?? 'computer'),
    players: (data['players'] as CardView['players'] | undefined) ?? [],
    ticks: Number(data['ticks'] ?? 0),
    winnerSeat:
      typeof data['winnerSeat'] === 'number' ? data['winnerSeat'] : null,
    score: Number(data['score'] ?? 0),
    reasons: (data['reasons'] as string[] | undefined) ?? [],
    featuredAt: millisOf(doc),
  };
}

/** A public replay as its own page shows it. */
function replayOf(doc: DocumentSnapshot): ReplayView {
  const endedBy: unknown = doc.get('endedBy');
  return {
    ...cardOf(doc),
    endedBy: typeof endedBy === 'string' ? endedBy : null,
    summary: (doc.get('summary') as ReplayView['summary'] | undefined) ?? {
      sizes: [],
      timeline: [],
    },
  };
}

function html(status: number, body: string): SiteResponse {
  return {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': CACHE,
    },
    body,
  };
}

function json(status: number, value: unknown): SiteResponse {
  return {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': CACHE,
      // Public data: the shell may fetch it.
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(value),
  };
}

function notFound(lang: Lang): SiteResponse {
  return html(404, statusPage(404, lang, 'notFound'));
}

function gone(lang: Lang, asJson: boolean): SiteResponse {
  return asJson
    ? json(410, { error: 'removed' })
    : html(410, statusPage(410, lang, 'removed'));
}
