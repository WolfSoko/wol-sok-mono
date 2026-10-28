import {
  clock,
  GAME_SITE_URL,
  getColonyColor,
  TICKS_PER_SEC,
} from '@wolsok/feat-lazy-bac-game/engine';
import type { PublicSeat } from '../gallery/publish';
import {
  colorName,
  endingName,
  type Lang,
  levelName,
  reasonName,
  t,
  type Word,
} from './texts';

/**
 * The public replay pages (ADR 0011): small server-rendered HTML with its
 * own minimal CSS, not the SPA, so link previews and crawlers see all of
 * it. Pure, so the specs check every page without a server. Names show in
 * the body only, never in the head (title, description, Open Graph,
 * JSON-LD): link previews and search snippets carry none.
 */

/** A public replay as a gallery card shows it. */
export interface CardView {
  id: string;
  levelId: string;
  kind: string;
  players: PublicSeat[];
  ticks: number;
  winnerSeat: number | null;
  score: number;
  reasons: string[];
  /** When it was featured, in ms. */
  featuredAt: number;
}

/** A public replay as its own page shows it. */
export interface ReplayView extends CardView {
  endedBy: string | null;
  summary: { sizes: number[]; timeline: number[] };
}

/** Text for HTML, in an element or an attribute. */
export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ] ?? char
  );
}

/** JSON for a `<script>`: `</` can never close it. */
export function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/**
 * A page's path in a language - English plain, German with `?lang=de` -
 * and further query parameters.
 */
export function inLang(
  path: string,
  lang: Lang,
  params: Readonly<Record<string, string>> = {}
): string {
  const query = new URLSearchParams({
    ...params,
    ...(lang === 'de' ? { lang } : {}),
  }).toString();
  return query === '' ? path : `${path}?${query}`;
}

/** A word of the pages, escaped. */
function text(
  lang: Lang,
  word: Word,
  params?: Readonly<Record<string, string>>
): string {
  return escapeHtml(t(lang, word, params));
}

/** A link to a page in a language, escaped for the attribute. */
function href(
  path: string,
  lang: Lang,
  params?: Readonly<Record<string, string>>
): string {
  return escapeHtml(inLang(path, lang, params));
}

/** A seat's label without its name: the computer, or the colony's colour. */
function seatLabel(lang: Lang, seat: PublicSeat): string {
  return seat.label === 'computer'
    ? t(lang, 'computer')
    : t(lang, 'colony', { color: colorName(lang, seat.colorId) });
}

/** The result, with names (`named`) for the body or without for the head. */
function result(lang: Lang, view: CardView, named: boolean): string {
  const winner =
    view.winnerSeat === null ? undefined : view.players[view.winnerSeat];
  if (winner === undefined) {
    return t(lang, 'draw');
  }
  const label = seatLabel(lang, winner);
  return t(lang, 'won', { player: named ? (winner.name ?? label) : label });
}

/** A match's length, `m:ss`. */
function length(ticks: number): string {
  return clock(Math.round(ticks / TICKS_PER_SEC));
}

/** The CSS colour of a colony. */
function rgb(colorId: string): string {
  return `rgb(${getColonyColor(colorId).rgb.join(',')})`;
}

interface Head {
  title: string;
  description: string;
  /** The page's path - its canonical URL and the language alternates. */
  path: string;
  type: 'website' | 'article';
  jsonLd?: unknown;
}

const STYLE = `body{margin:0;font-family:system-ui,sans-serif;background:#0d1117;color:#e6edf3;line-height:1.5}
main{max-width:46rem;margin:0 auto;padding:1rem}a{color:#7cc4ff}h1{font-size:1.6rem;margin:.5rem 0}
.card{display:block;background:#161b22;border-radius:.6rem;padding:.8rem 1rem;margin:.8rem 0;text-decoration:none;color:inherit}
.swatch{display:inline-block;width:.8em;height:.8em;border-radius:50%;margin-right:.3em;vertical-align:middle}
.badge{display:inline-block;background:#30363d;border-radius:1rem;padding:0 .6rem;margin:.2rem .3rem 0 0;font-size:.85rem}
.button{display:inline-block;background:#238636;color:#fff;padding:.5rem 1rem;border-radius:.4rem;text-decoration:none;margin:.5rem .5rem 0 0}
nav{display:flex;justify-content:space-between;flex-wrap:wrap;gap:.5rem}dl{display:grid;grid-template-columns:auto 1fr;gap:.2rem 1rem}
dt{color:#8b949e}svg{width:100%;height:auto;background:#161b22;border-radius:.6rem}`;

/** A whole page around its body. */
function page(lang: Lang, head: Head, body: string): string {
  const url = (l: Lang) =>
    escapeHtml(`${GAME_SITE_URL}${inLang(head.path, l)}`);
  const other: Lang = lang === 'de' ? 'en' : 'de';
  const title = escapeHtml(head.title);
  const description = escapeHtml(head.description);
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${url(lang)}">
<link rel="alternate" hreflang="en" href="${url('en')}">
<link rel="alternate" hreflang="de" href="${url('de')}">
<link rel="alternate" hreflang="x-default" href="${url('en')}">
<meta property="og:type" content="${head.type}">
<meta property="og:site_name" content="Bacteria Wars">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${url(lang)}">
<meta name="twitter:card" content="summary">
${head.jsonLd === undefined ? '' : `<script type="application/ld+json">${scriptJson(head.jsonLd)}</script>\n`}<style>${STYLE}</style>
</head>
<body>
<main>
<nav><a href="${href('/replays', lang)}">${text(lang, 'gallery')}</a><a href="${href(head.path, other)}" hreflang="${other}">${text(lang, 'language')}</a></nav>
${body}
<p><a class="button" href="/">${text(lang, 'play')}</a></p>
</main>
</body>
</html>
`;
}

/** The players of a match, with their colours - names where public. */
function playersLine(lang: Lang, view: CardView): string {
  return view.players
    .map(
      (seat) =>
        `<span class="swatch" style="background:${rgb(seat.colorId)}"></span>${escapeHtml(seat.name ?? seatLabel(lang, seat))}`
    )
    .join(` <span>${text(lang, 'vs')}</span> `);
}

/** The score reasons as badges. */
function badges(lang: Lang, reasons: readonly string[]): string {
  return reasons
    .map((r) => `<span class="badge">${escapeHtml(reasonName(lang, r))}</span>`)
    .join('');
}

/** A gallery card: the level, the players, the result and the badges. */
function card(lang: Lang, view: CardView): string {
  const level = escapeHtml(levelName(lang, view.levelId, view.kind));
  const outcome = escapeHtml(result(lang, view, true));
  return `<a class="card" href="${href(`/replays/${view.id}`, lang)}"><strong>${level}</strong><br>${playersLine(lang, view)}<br>${outcome} · ${length(view.ticks)}<br>${badges(lang, view.reasons)}</a>`;
}

/**
 * `/replays`: the matches of the day, newest first, and a link to the
 * older ones (`older`, the next page's cursor) where there are more.
 */
export function galleryPage(
  lang: Lang,
  views: readonly CardView[],
  older: string | null = null
): string {
  const cards =
    views.length === 0
      ? `<p>${text(lang, 'empty')}</p>`
      : views.map((view) => card(lang, view)).join('\n');
  const more =
    older === null
      ? ''
      : `\n<p><a href="${href('/replays', lang, { before: older })}">${text(lang, 'older')}</a></p>`;
  return page(
    lang,
    {
      title: `${t(lang, 'gallery')} | ${t(lang, 'site')}`,
      description: t(lang, 'galleryIntro'),
      path: '/replays',
      type: 'website',
    },
    `<h1>${text(lang, 'gallery')}</h1>\n<p>${text(lang, 'galleryIntro')}</p>\n${cards}${more}`
  );
}

/** The colony sizes over the match, one line a seat. */
function timeline(lang: Lang, view: ReplayView): string {
  const seats = Math.max(1, view.summary.sizes.length);
  const points = Math.floor(view.summary.timeline.length / seats);
  if (points < 2) {
    return '';
  }
  const max = Math.max(1, ...view.summary.timeline);
  const lines = view.players
    .map((seat, s) => {
      const coords = Array.from({ length: points }, (_, i) => {
        const size = view.summary.timeline[i * seats + s] ?? 0;
        return `${((i / (points - 1)) * 300).toFixed(1)},${(100 - (size / max) * 95).toFixed(1)}`;
      }).join(' ');
      return `<polyline fill="none" stroke="${rgb(seat.colorId)}" stroke-width="2" points="${coords}"/>`;
    })
    .join('');
  return `<svg viewBox="0 0 300 100" role="img" aria-label="${text(lang, 'timeline')}">${lines}</svg>`;
}

/** `/replays/{id}`: one match of the day. */
export function replayPage(lang: Lang, view: ReplayView): string {
  const level = levelName(lang, view.levelId, view.kind);
  const description = t(lang, 'description', {
    level,
    result: result(lang, view, false),
  });
  const ending =
    view.endedBy === null
      ? ''
      : `<dt>${text(lang, 'ending')}</dt><dd>${escapeHtml(endingName(lang, view.endedBy))}</dd>`;
  return page(
    lang,
    {
      title: `${t(lang, 'matchOfTheDay')}: ${level} | ${t(lang, 'site')}`,
      description,
      path: `/replays/${view.id}`,
      type: 'article',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'VideoGame',
        name: 'Bacteria Wars',
        url: GAME_SITE_URL,
        description,
      },
    },
    `<h1>${text(lang, 'matchOfTheDay')}: ${escapeHtml(level)}</h1>
<p>${playersLine(lang, view)}</p>
<p><strong>${escapeHtml(result(lang, view, true))}</strong></p>
<p><a class="button" href="${escapeHtml(`/watch/${view.id}`)}">${text(lang, 'watch')}</a></p>
<dl><dt>${text(lang, 'length')}</dt><dd>${length(view.ticks)}</dd>${ending}<dt>${text(lang, 'score')}</dt><dd>${view.score} ${badges(lang, view.reasons)}</dd></dl>
${timeline(lang, view)}
<p><a href="${href('/replays', lang)}">${text(lang, 'back')}</a></p>`
  );
}

/** A short page for an answer without content, never indexed. */
export function statusPage(
  status: 404 | 410,
  lang: Lang,
  word: 'notFound' | 'removed'
): string {
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>${status}</title></head><body><p>${text(lang, word)}</p><p><a href="${href('/replays', lang)}">${text(lang, 'gallery')}</a></p></body></html>`;
}

/** `/replays/sitemap.xml`: the gallery and every public replay. */
export function sitemap(
  replays: readonly { id: string; featuredAt: number }[]
): string {
  const url = (path: string, lastmod?: number) =>
    `<url><loc>${escapeHtml(`${GAME_SITE_URL}${path}`)}</loc>${
      lastmod === undefined
        ? ''
        : `<lastmod>${new Date(lastmod).toISOString().slice(0, 10)}</lastmod>`
    }</url>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[url('/replays'), ...replays.map((r) => url(`/replays/${r.id}`, r.featuredAt))].join('\n')}
</urlset>
`;
}
