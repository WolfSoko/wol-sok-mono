import {
  type DocumentSnapshot,
  type Firestore,
  Timestamp,
} from 'firebase-admin/firestore';
import {
  escapeHtml,
  galleryPage,
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
/** The replays the sitemap lists at most. */
const SITEMAP_SIZE = 1_000;
/** A public replay's id: Firestore's random ids, nothing else is read. */
const PUBLIC_ID = /^[A-Za-z0-9]{20}$/;

/** Hosting's CDN caches it for two minutes - a takedown waits that long. */
const CACHE = 'public, max-age=60, s-maxage=120';

/**
 * `publicSite` (ADR 0011), behind Hosting's rewrites of `/replays` and
 * `/replays/**`: the gallery (`/replays`, `/replays/index.json`), one
 * replay (`/replays/{id}`, `/replays/{id}/replay.json` for the viewer) and
 * the replays' sitemap (`/replays/sitemap.xml`). It reads `publicReplays`
 * only: a private id answers 404 like an unknown one, a removed replay
 * 410. `?lang=de` for German, English otherwise.
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
  if (parts[0] !== 'replays') {
    return notFound(lang);
  }
  const [, id, file] = parts;
  if (id === undefined) {
    return html(200, galleryPage(lang, await latest(db, GALLERY_SIZE)));
  }
  if (id === 'index.json' && file === undefined) {
    return json(200, { replays: await latest(db, GALLERY_SIZE) });
  }
  if (id === 'sitemap.xml' && file === undefined) {
    return {
      status: 200,
      headers: { 'Content-Type': 'application/xml', 'Cache-Control': CACHE },
      body: sitemap(await latest(db, SITEMAP_SIZE)),
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

/** The public replays still up, newest first. */
async function latest(db: Firestore, limit: number): Promise<PublicView[]> {
  const snapshot = await db
    .collection('publicReplays')
    .where('removedAt', '==', null)
    .orderBy('featuredAt', 'desc')
    .limit(limit)
    .get();
  return snapshot.docs.map(viewOf);
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
    `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>${status}</title></head><body><p>${escapeHtml(text)}</p><p><a href="/replays">Bacteria Wars</a></p></body></html>`
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
