import {
  type DocumentSnapshot,
  FieldPath,
  type Firestore,
  type Query,
  Timestamp,
} from 'firebase-admin/firestore';
import {
  escapeHtml,
  galleryPage,
  inLang,
  type PublicView,
  replayPage,
  sitemap,
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
/** A public replay's id: Firestore's random ids, nothing else is read. */
const PUBLIC_ID = /^[A-Za-z0-9]{20}$/;

/**
 * Hosting's CDN keeps a page two minutes and a browser one more, so a
 * takedown can take up to three minutes to show everywhere (ADR 0011).
 */
const CACHE = 'public, max-age=60, s-maxage=120';
/** The sitemap changes once a day: an hour, so a miss is rare. */
const SITEMAP_CACHE = 'public, max-age=3600, s-maxage=3600';
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
      body: sitemap(listed.docs.map(viewOf)),
    };
  }
  if (!PUBLIC_ID.test(id) || (file !== undefined && file !== 'replay.json')) {
    return notFound(lang);
  }
  const doc = await db.doc(`publicReplays/${id}`).get();
  const removedAt: unknown = doc.get('removedAt');
  if (!doc.exists) {
    return notFound(lang);
  }
  if (removedAt !== null && removedAt !== undefined) {
    return gone(lang, file !== undefined);
  }
  if (file === undefined) {
    return html(200, replayPage(lang, viewOf(doc)));
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
): Promise<{ views: PublicView[]; older: string | null }> {
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
  const views = snapshot.docs.slice(0, GALLERY_SIZE).map(viewOf);
  const last = views.at(-1);
  return {
    views,
    older:
      snapshot.size > GALLERY_SIZE && last !== undefined
        ? `${last.featuredAt}_${last.id}`
        : null,
  };
}

/** A public replay as the pages show it. */
function viewOf(doc: DocumentSnapshot): PublicView {
  const data = doc.data() ?? {};
  const featuredAt = data['featuredAt'];
  return {
    id: doc.id,
    levelId: String(data['levelId'] ?? ''),
    kind: String(data['kind'] ?? 'computer'),
    players: (data['players'] as PublicView['players'] | undefined) ?? [],
    ticks: Number(data['ticks'] ?? 0),
    endedBy: typeof data['endedBy'] === 'string' ? data['endedBy'] : null,
    winnerSeat:
      typeof data['winnerSeat'] === 'number' ? data['winnerSeat'] : null,
    score: Number(data['score'] ?? 0),
    reasons: (data['reasons'] as string[] | undefined) ?? [],
    summary: (data['summary'] as PublicView['summary'] | undefined) ?? {
      sizes: [],
      timeline: [],
    },
    featuredAt: featuredAt instanceof Timestamp ? featuredAt.toMillis() : 0,
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

/** A short page for an answer without content, never indexed. */
function plain(status: number, lang: Lang, text: string): SiteResponse {
  return html(
    status,
    `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>${status}</title></head><body><p>${escapeHtml(text)}</p><p><a href="${escapeHtml(inLang('/replays', lang))}">Bacteria Wars</a></p></body></html>`
  );
}

function notFound(lang: Lang): SiteResponse {
  return plain(404, lang, lang === 'de' ? 'Nicht gefunden.' : 'Not found.');
}

function gone(lang: Lang, asJson: boolean): SiteResponse {
  return asJson
    ? json(410, { error: 'removed' })
    : plain(
        410,
        lang,
        lang === 'de'
          ? 'Dieses Match ist nicht mehr öffentlich.'
          : 'This match is no longer public.'
      );
}
