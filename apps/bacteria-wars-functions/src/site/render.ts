import {
  COLONY_COLORS,
  TICKS_PER_SEC,
} from '@wolsok/feat-lazy-bac-game/engine';
import {
  colorName,
  endingName,
  type Lang,
  levelName,
  reasonName,
  t,
} from './texts';
import type { PublicSeat } from '../gallery/publish';

/**
 * The public replay pages (ADR 0011): small server-rendered HTML with its
 * own minimal CSS, not the SPA, so link previews and crawlers see all of
 * it. Pure, so the specs check every page without a server. Names show in
 * the body only, never in the head (title, description, Open Graph,
 * JSON-LD): link previews and search snippets carry none.
 */

/** Where the pages live. */
export const SITE_URL = 'https://bacteria-wars.wolsok.de';

/** A public replay as the pages show it. */
export interface PublicView {
  id: string;
  levelId: string;
  kind: string;
  players: PublicSeat[];
  ticks: number;
  endedBy: string | null;
  winnerSeat: number | null;
  score: number;
  reasons: string[];
  summary: { sizes: number[]; timeline: number[] };
  /** When it was featured, in ms. */
  featuredAt: number;
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

/** A seat's label without its name: the computer, or the colony's colour. */
function seatLabel(lang: Lang, seat: PublicSeat): string {
  return seat.label === 'computer'
    ? t(lang, 'computer')
    : t(lang, 'colony', { color: colorName(lang, seat.colorId) });
}

/** A seat as the body shows it: the player's name where they made it public. */
function seatName(lang: Lang, seat: PublicSeat): string {
  return seat.name ?? seatLabel(lang, seat);
}

/** The result, with names (`named`) for the body or without for the head. */
function result(lang: Lang, view: PublicView, named: boolean): string {
  const winner =
    view.winnerSeat === null ? undefined : view.players[view.winnerSeat];
  if (winner === undefined) {
    return t(lang, 'draw');
  }
  return t(lang, 'won', {
    player: named ? seatName(lang, winner) : seatLabel(lang, winner),
  });
}

/** A match's length, `m:ss`. */
function length(ticks: number): string {
  const seconds = Math.round(ticks / TICKS_PER_SEC);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** The CSS colour of a colony. */
function rgb(colorId: string): string {
  const color = COLONY_COLORS.find((c) => c.id === colorId);
  return color === undefined ? '#999' : `rgb(${color.rgb.join(',')})`;
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
  const url = (l: Lang) => `${SITE_URL}${inLang(head.path, l)}`;
  const other: Lang = lang === 'de' ? 'en' : 'de';
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(head.title)}</title>
<meta name="description" content="${escapeHtml(head.description)}">
<link rel="canonical" href="${escapeHtml(url(lang))}">
<link rel="alternate" hreflang="en" href="${escapeHtml(url('en'))}">
<link rel="alternate" hreflang="de" href="${escapeHtml(url('de'))}">
<link rel="alternate" hreflang="x-default" href="${escapeHtml(url('en'))}">
<meta property="og:type" content="${head.type}">
<meta property="og:site_name" content="Bacteria Wars">
<meta property="og:title" content="${escapeHtml(head.title)}">
<meta property="og:description" content="${escapeHtml(head.description)}">
<meta property="og:url" content="${escapeHtml(url(lang))}">
<meta name="twitter:card" content="summary">
${head.jsonLd === undefined ? '' : `<script type="application/ld+json">${scriptJson(head.jsonLd)}</script>\n`}<style>${STYLE}</style>
</head>
<body>
<main>
<nav><a href="${escapeHtml(inLang('/replays', lang))}">${escapeHtml(t(lang, 'gallery'))}</a><a href="${escapeHtml(inLang(head.path, other))}" hreflang="${other}">${escapeHtml(t(lang, 'language'))}</a></nav>
${body}
<p><a class="button" href="/">${escapeHtml(t(lang, 'play'))}</a></p>
</main>
</body>
</html>
`;
}

/** The players of a match, with their colours. */
function playersLine(lang: Lang, view: PublicView): string {
  return view.players
    .map(
      (seat) =>
        `<span class="swatch" style="background:${rgb(seat.colorId)}"></span>${escapeHtml(seatName(lang, seat))}`
    )
    .join(` <span>${escapeHtml(t(lang, 'vs'))}</span> `);
}

/** The score reasons as badges. */
function badges(lang: Lang, reasons: readonly string[]): string {
  return reasons
    .map((r) => `<span class="badge">${escapeHtml(reasonName(lang, r))}</span>`)
    .join('');
}

/**
 * `/replays`: the matches of the day, newest first, and a link to the
 * older ones (`older`, the next page's cursor) where there are more.
 */
export function galleryPage(
  lang: Lang,
  views: readonly PublicView[],
  older: string | null = null
): string {
  const cards =
    views.length === 0
      ? `<p>${escapeHtml(t(lang, 'empty'))}</p>`
      : views
          .map(
            (view) =>
              `<a class="card" href="${escapeHtml(inLang(`/replays/${view.id}`, lang))}"><strong>${escapeHtml(levelName(lang, view.levelId, view.kind))}</strong><br>${playersLine(lang, view)}<br>${escapeHtml(result(lang, view, true))} · ${length(view.ticks)}<br>${badges(lang, view.reasons)}</a>`
          )
          .join('\n');
  return page(
    lang,
    {
      title: `${t(lang, 'gallery')} | ${t(lang, 'site')}`,
      description: t(lang, 'galleryIntro'),
      path: '/replays',
      type: 'website',
    },
    `<h1>${escapeHtml(t(lang, 'gallery'))}</h1>\n<p>${escapeHtml(t(lang, 'galleryIntro'))}</p>\n${cards}${
      older === null
        ? ''
        : `\n<p><a href="${escapeHtml(inLang('/replays', lang, { before: older }))}">${escapeHtml(t(lang, 'older'))}</a></p>`
    }`
  );
}

/** The colony sizes over the match, one line a seat. */
function timeline(lang: Lang, view: PublicView): string {
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
  return `<svg viewBox="0 0 300 100" role="img" aria-label="${escapeHtml(t(lang, 'timeline'))}">${lines}</svg>`;
}

/** `/replays/{id}`: one match of the day. */
export function replayPage(lang: Lang, view: PublicView): string {
  const level = levelName(lang, view.levelId, view.kind);
  const title = `${t(lang, 'matchOfTheDay')}: ${level} | ${t(lang, 'site')}`;
  const description = t(lang, 'description', {
    level,
    result: result(lang, view, false),
  });
  const path = `/replays/${view.id}`;
  return page(
    lang,
    {
      title,
      description,
      path,
      type: 'article',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'VideoGame',
        name: 'Bacteria Wars',
        url: SITE_URL,
        description,
      },
    },
    `<h1>${escapeHtml(t(lang, 'matchOfTheDay'))}: ${escapeHtml(level)}</h1>
<p>${playersLine(lang, view)}</p>
<p><strong>${escapeHtml(result(lang, view, true))}</strong></p>
<dl><dt>${escapeHtml(t(lang, 'length'))}</dt><dd>${length(view.ticks)}</dd>${
      view.endedBy === null
        ? ''
        : `<dt>${escapeHtml(t(lang, 'ending'))}</dt><dd>${escapeHtml(endingName(lang, view.endedBy))}</dd>`
    }<dt>${escapeHtml(t(lang, 'score'))}</dt><dd>${view.score} ${badges(lang, view.reasons)}</dd></dl>
${timeline(lang, view)}
<p><a class="button" href="${escapeHtml(`${SITE_URL}${inLang(path, lang)}`)}">${escapeHtml(t(lang, 'share'))}</a></p>
<p><a href="${escapeHtml(inLang('/replays', lang))}">${escapeHtml(t(lang, 'back'))}</a></p>`
  );
}

/** `/replays/sitemap.xml`: the gallery and every public replay. */
export function sitemap(views: readonly PublicView[]): string {
  const url = (path: string, lastmod?: number) =>
    `<url><loc>${escapeHtml(`${SITE_URL}${path}`)}</loc>${
      lastmod === undefined
        ? ''
        : `<lastmod>${new Date(lastmod).toISOString().slice(0, 10)}</lastmod>`
    }</url>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[url('/replays'), ...views.map((v) => url(`/replays/${v.id}`, v.featuredAt))].join('\n')}
</urlset>
`;
}
