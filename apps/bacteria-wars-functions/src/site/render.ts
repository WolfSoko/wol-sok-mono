import {
  clock,
  getColonyColor,
  LOCALES,
  TICKS_PER_SEC,
} from '@wolsok/feat-shared-bacteria-engine';
import type { PublicSeat } from '../gallery/publish';
import { dayOf } from '../limits';
import { escapeHtml, href, text } from './html';
import { GAME_JSONLD_ID, gameJsonLd, page, pageUrl } from './layout';
import {
  colorName,
  endingName,
  type Lang,
  levelName,
  reasonName,
  t,
} from './texts';

/**
 * The public replay pages (ADR 0011): small server-rendered HTML in the
 * game's look (`layout.ts`), not the SPA, so link previews and crawlers see
 * all of it. Pure, so the specs check every page without a server. Names
 * show in the body only, never in the head (title, description, Open Graph,
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

/** How the pages write the day a replay was picked, per language. */
const PICKED_FORMAT: Record<Lang, Intl.DateTimeFormat> = {
  en: pickedFormat('en'),
  de: pickedFormat('de'),
};

function pickedFormat(lang: Lang): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(LOCALES[lang], {
    dateStyle: 'medium',
    timeZone: 'UTC',
  });
}

/** True when a replay's pick date is known (`featuredAt` is 0 otherwise). */
function isPicked(featuredAt: number): boolean {
  return featuredAt > 0;
}

/**
 * The day a replay was picked, in the page's language, after `prefix` -
 * nothing where it is unknown.
 */
function pickedOn(lang: Lang, featuredAt: number, prefix = ''): string {
  if (!isPicked(featuredAt)) {
    return '';
  }
  const shown = PICKED_FORMAT[lang].format(featuredAt);
  return `${prefix}<time datetime="${dayOf(featuredAt)}">${text(lang, 'picked', { date: shown })}</time>`;
}

/** The players of a match, with their colours - names where public. */
function playersLine(lang: Lang, view: CardView): string {
  return view.players
    .map(
      (seat) =>
        `<span><span class="swatch" style="background:${rgb(seat.colorId)};color:${rgb(seat.colorId)}"></span>${escapeHtml(seat.name ?? seatLabel(lang, seat))}</span>`
    )
    .join(`<span class="vs">${text(lang, 'vs')}</span>`);
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
  return `<li><a class="card" href="${href(`/replays/${view.id}`, lang)}"><h2>${level}</h2>
<p class="players">${playersLine(lang, view)}</p>
<span class="result">${outcome} · ${length(view.ticks)}</span>
<span class="meta">${pickedOn(lang, view.featuredAt)}</span>
<span class="badges">${badges(lang, view.reasons)}</span></a></li>`;
}

/** The way into the game, under every page's content. */
function playButton(lang: Lang): string {
  return `<a class="button primary" href="/">▶ ${text(lang, 'play')}</a>`;
}

/**
 * `/replays`: the matches of the day, newest first, and a link to the
 * older ones (`older`, the next page's cursor) where there are more.
 * `before` is the cursor this page starts after, null for the first:
 * each page is its own canonical URL, so every one of them is indexed -
 * but one past the last replay, which only a typed cursor reaches.
 */
export function galleryPage(
  lang: Lang,
  views: readonly CardView[],
  older: string | null = null,
  before: string | null = null
): string {
  const params: Record<string, string> = before === null ? {} : { before };
  const cards =
    views.length === 0
      ? `<p class="panel">${text(lang, 'empty')}</p>`
      : `<ul class="cards">\n${views.map((view) => card(lang, view)).join('\n')}\n</ul>`;
  const more =
    older === null
      ? ''
      : `\n<p class="more"><a class="button secondary" href="${href('/replays', lang, { before: older })}">${text(lang, 'older')}</a></p>`;
  const title = `${t(lang, 'gallery')} | ${t(lang, 'site')}`;
  return page(
    lang,
    {
      title,
      description: t(lang, 'galleryIntro'),
      path: '/replays',
      params,
      type: 'website',
      noindex: before !== null && views.length === 0,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'CollectionPage',
            name: title,
            url: pageUrl('/replays', lang, params),
            inLanguage: lang,
            description: t(lang, 'galleryIntro'),
            about: { '@id': GAME_JSONLD_ID },
            mainEntity: {
              '@type': 'ItemList',
              itemListElement: views.map((view, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                url: pageUrl(`/replays/${view.id}`, lang),
              })),
            },
          },
          gameJsonLd(lang),
        ],
      },
    },
    `<h1>${text(lang, 'gallery')}</h1>
<p class="lead">${text(lang, 'galleryIntro')}</p>
<p class="about">${text(lang, 'about')}</p>
${playButton(lang)}
${cards}${more}`
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
      return `<polyline fill="none" stroke="${rgb(seat.colorId)}" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke" points="${coords}"/>`;
    })
    .join('');
  return `<svg class="timeline" viewBox="0 0 300 100" preserveAspectRatio="none" role="img" aria-label="${text(lang, 'timeline')}">${lines}</svg>`;
}

/** `/replays/{id}`: one match of the day. */
export function replayPage(lang: Lang, view: ReplayView): string {
  const level = levelName(lang, view.levelId, view.kind);
  const description = t(lang, 'description', {
    level,
    result: result(lang, view, false),
  });
  const path = `/replays/${view.id}`;
  const title = `${t(lang, 'matchOfTheDay')}: ${level}`;
  const ending =
    view.endedBy === null
      ? ''
      : `<dt>${text(lang, 'ending')}</dt><dd>${escapeHtml(endingName(lang, view.endedBy))}</dd>`;
  return page(
    lang,
    {
      title: `${title} | ${t(lang, 'site')}`,
      description,
      path,
      type: 'article',
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'WebPage',
            name: title,
            url: pageUrl(path, lang),
            inLanguage: lang,
            description,
            ...(isPicked(view.featuredAt)
              ? { datePublished: new Date(view.featuredAt).toISOString() }
              : {}),
            about: { '@id': GAME_JSONLD_ID },
            breadcrumb: {
              '@type': 'BreadcrumbList',
              itemListElement: [
                {
                  '@type': 'ListItem',
                  position: 1,
                  name: t(lang, 'gallery'),
                  item: pageUrl('/replays', lang),
                },
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: title,
                  item: pageUrl(path, lang),
                },
              ],
            },
          },
          gameJsonLd(lang),
        ],
      },
    },
    `<p class="meta"><a href="${href('/replays', lang)}">${text(lang, 'gallery')}</a>${pickedOn(lang, view.featuredAt, ' › ')}</p>
<h1>${text(lang, 'matchOfTheDay')}: ${escapeHtml(level)}</h1>
<p class="players lead">${playersLine(lang, view)}</p>
<p class="result lead">${escapeHtml(result(lang, view, true))}</p>
<p><a class="button primary" href="${escapeHtml(`/watch/${view.id}`)}">▶ ${text(lang, 'watch')}</a><a class="button secondary" href="/">${text(lang, 'play')}</a></p>
<section class="panel"><dl><dt>${text(lang, 'length')}</dt><dd>${length(view.ticks)}</dd>${ending}<dt>${text(lang, 'score')}</dt><dd>${view.score} <span class="badges">${badges(lang, view.reasons)}</span></dd></dl></section>
${timeline(lang, view)}
<p><a href="${href('/replays', lang)}">${text(lang, 'back')}</a></p>
<p class="about">${text(lang, 'about')}</p>`
  );
}

/**
 * A short page for an answer without content, never indexed. `path` is
 * the page asked for, which its language switch leads to.
 */
export function statusPage(
  status: 404 | 410,
  lang: Lang,
  word: 'notFound' | 'removed',
  path: string
): string {
  return page(
    lang,
    {
      title: `${status} | ${t(lang, 'site')}`,
      description: t(lang, word),
      path,
      type: 'website',
      noindex: true,
    },
    `<h1>${text(lang, word)}</h1>
<p><a class="button secondary" href="${href('/replays', lang)}">${text(lang, 'gallery')}</a>${playButton(lang)}</p>`
  );
}

/** The languages every page of the sitemap is listed in. */
const SITEMAP_LANGS = ['en', 'de'] as const;
/** The URLs one sitemap may hold (sitemaps.org). */
const SITEMAP_URL_LIMIT = 50_000;
/**
 * The replays one sitemap lists at most: each one, like the gallery,
 * takes a URL per language. Some 70 years of daily picks.
 */
export const SITEMAP_REPLAYS =
  Math.floor(SITEMAP_URL_LIMIT / SITEMAP_LANGS.length) - 1;

/**
 * `/replays/sitemap.xml`: the gallery and the newest public replays (at
 * most `SITEMAP_REPLAYS`), in English and German, each naming the other as
 * its language alternate.
 */
export function sitemap(
  replays: readonly { id: string; featuredAt: number }[]
): string {
  const urls = (path: string, lastmod?: number) => {
    const locs = SITEMAP_LANGS.map((lang) => ({
      lang,
      loc: escapeHtml(pageUrl(path, lang)),
    }));
    const alternates = locs
      .map(
        ({ lang, loc }) =>
          `<xhtml:link rel="alternate" hreflang="${lang}" href="${loc}"/>`
      )
      .join('');
    const modified =
      lastmod === undefined ? '' : `<lastmod>${dayOf(lastmod)}</lastmod>`;
    return locs.map(
      ({ loc }) => `<url><loc>${loc}</loc>${modified}${alternates}</url>`
    );
  };
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${[urls('/replays'), ...replays.slice(0, SITEMAP_REPLAYS).map((r) => urls(`/replays/${r.id}`, r.featuredAt))].flat().join('\n')}
</urlset>
`;
}
