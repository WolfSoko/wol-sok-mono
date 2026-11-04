import {
  GAME_SITE_URL,
  LEGAL_NOTICE_PATH,
  LOCALES,
  PRIVACY_POLICY_PATH,
} from '@wolsok/feat-shared-bacteria-engine';
import { escapeHtml, href, inLang, scriptJson, text } from './html';
import { type Lang, t } from './texts';

/**
 * The frame of the public replay pages (ADR 0011): head, header and footer
 * in the look of the game's menus - the dark lab dish, gold for what
 * counts, the colony's orange for the way into the game - and its faces,
 * Bricolage Grotesque for headings and Atkinson Hyperlegible for text.
 * The pages are no part of the SPA, so their CSS is their own, inline.
 */

/**
 * The faces the pages load, from the game's site: `bacteria-game-remote`
 * copies them from Fontsource into `/fonts` (its `project.json` assets,
 * which `layout.spec.ts` checks), as its styles never reach these pages.
 */
export const SITE_FONTS = [
  {
    family: 'Bricolage Grotesque',
    weight: 800,
    file: 'bricolage-grotesque-latin-800-normal.woff2',
  },
  {
    family: 'Atkinson Hyperlegible',
    weight: 400,
    file: 'atkinson-hyperlegible-latin-400-normal.woff2',
  },
  {
    family: 'Atkinson Hyperlegible',
    weight: 700,
    file: 'atkinson-hyperlegible-latin-700-normal.woff2',
  },
] as const;

/** The game's logo, also the pages' preview image. */
const LOGO = '/icons/icon-192.png';
const PREVIEW_IMAGE = `${GAME_SITE_URL}/icons/icon-512.png`;
/** The game's ground, as the browser's chrome shows it. */
const THEME_COLOR = '#0b0f14';

const FONT_FACES = SITE_FONTS.map(
  ({ family, weight, file }) =>
    `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;src:url(/fonts/${file}) format('woff2')}`
).join('\n');

// The tokens are the menus' (`menu/_screen.scss` in the game lib).
const STYLE = `${FONT_FACES}
:root{--ground:${THEME_COLOR};--surface:#121821;--raised:#19212c;--line:#263142;--line-strong:#3a4659;--text:#e8eef5;--soft:#b7c3d0;--muted:#9aa8b8;--gold:#e9b949;--orange:#ff7a2e;--on-orange:#1a0d05;--display:'Bricolage Grotesque',system-ui,sans-serif;--body:'Atkinson Hyperlegible',system-ui,sans-serif;color-scheme:dark}
*,*::before,*::after{box-sizing:border-box}
body{margin:0;min-height:100vh;background:radial-gradient(circle at 50% -20%,#1a2433 0,var(--ground) 60%) fixed var(--ground);color:var(--text);font:1rem/1.55 var(--body)}
.wrap{max-width:52rem;margin:0 auto;padding:1rem}
a{color:var(--gold);text-underline-offset:.2em}
a:focus-visible{outline:3px solid var(--gold);outline-offset:2px;border-radius:.3rem}
.top{display:flex;flex-wrap:wrap;align-items:center;gap:.75rem 1rem;padding:.5rem 0 1.5rem}
.brand{display:flex;align-items:center;gap:.75rem;color:var(--text);text-decoration:none;font:800 1.6rem/1 var(--display);letter-spacing:-.03em}
.brand img{width:3rem;height:3rem;border-radius:50%;box-shadow:0 0 0 2px rgb(233 185 73 / 60%),0 0 24px rgb(233 185 73 / 25%)}
.brand em{font-style:normal;color:var(--orange)}
.top nav{margin-left:auto;display:flex;flex-wrap:wrap;gap:.5rem 1rem;align-items:center}
h1,h2{font-family:var(--display);font-weight:800;letter-spacing:-.02em;line-height:1.1}
h1{font-size:clamp(1.8rem,6vw,2.75rem);margin:0 0 .5rem}
h2{font-size:1.25rem;margin:0}
.lead{color:var(--soft);font-size:1.1rem;margin:0 0 .5rem}
.about{color:var(--muted);margin:0 0 1.5rem}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(16rem,1fr));gap:1rem;margin:1rem 0;padding:0;list-style:none}
.card{display:flex;flex-direction:column;gap:.4rem;height:100%;background:var(--surface);border:1px solid var(--line);border-radius:1.25rem;padding:1rem 1.1rem;color:inherit;text-decoration:none;transition:border-color .15s,transform .15s}
.card:hover{border-color:var(--gold);transform:translateY(-2px)}
.result{font-weight:700}
.meta{color:var(--muted);font-size:.9rem}
.players{display:flex;flex-wrap:wrap;align-items:center;gap:.25rem .5rem;margin:0}
.vs{color:var(--muted);font-size:.85rem}
.swatch{display:inline-block;width:.9em;height:.9em;border-radius:50%;margin-right:.35em;vertical-align:-.1em;box-shadow:0 0 8px currentColor}
.badges{display:flex;flex-wrap:wrap;gap:.3rem;margin-top:auto}
.badge{display:inline-block;background:var(--raised);border:1px solid var(--line-strong);color:var(--soft);border-radius:1rem;padding:0 .6rem;font-size:.8rem;font-weight:700}
.panel{background:var(--surface);border:1px solid var(--line);border-radius:1.25rem;padding:1.1rem 1.25rem;margin:1rem 0}
.button{display:inline-flex;align-items:center;gap:.4rem;padding:.65rem 1.2rem;border-radius:.9rem;font:800 1.1rem/1.2 var(--display);text-decoration:none;margin:.25rem .5rem .25rem 0}
.primary{background:var(--orange);color:var(--on-orange)}
.secondary{border:1px solid var(--gold);color:var(--text)}
.button:hover{filter:brightness(1.1)}
dl{display:grid;grid-template-columns:auto 1fr;gap:.35rem 1rem;margin:0}
dt{color:var(--muted)}dd{margin:0}
svg.timeline{display:block;width:100%;height:clamp(7rem,25vw,12rem);background:var(--raised);border-radius:.8rem}
.more{text-align:center;margin:1.5rem 0}
.foot{display:flex;flex-wrap:wrap;justify-content:space-between;gap:.5rem 1.5rem;margin-top:3rem;padding:.75rem 0 1rem;border-top:1px solid var(--line);color:var(--muted);font-size:.85rem}
.foot nav{display:flex;flex-wrap:wrap;gap:.25rem 1.25rem}
.foot a{color:var(--soft)}
@media (prefers-reduced-motion:reduce){.card{transition:none}.card:hover{transform:none}}`;

export interface Head {
  title: string;
  description: string;
  /** The page's path - its canonical URL and the language alternates. */
  path: string;
  /** Query parameters of the page beyond the language (`before`). */
  params?: Readonly<Record<string, string>>;
  type: 'website' | 'article';
  jsonLd?: unknown;
  /**
   * True for a page that must not be indexed: an answer without content
   * (404, 410) or a gallery page past the last replay.
   */
  noindex?: boolean;
}

/** A page's absolute URL in a language. */
export function pageUrl(
  path: string,
  lang: Lang,
  params?: Readonly<Record<string, string>>
): string {
  return `${GAME_SITE_URL}${inLang(path, lang, params)}`;
}

/** A whole page around its body. */
export function page(lang: Lang, head: Head, body: string): string {
  const title = escapeHtml(head.title);
  const description = escapeHtml(head.description);
  const other: Lang = lang === 'de' ? 'en' : 'de';
  const preloads = SITE_FONTS.map(
    ({ file }) =>
      `<link rel="preload" href="/fonts/${file}" as="font" type="font/woff2" crossorigin>`
  ).join('\n');
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
${head.noindex === true ? '<meta name="robots" content="noindex">\n' : indexed(head, lang, title, description)}<meta name="theme-color" content="${THEME_COLOR}">
<link rel="icon" href="/favicon.ico">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
${preloads}
<style>${STYLE}</style>
</head>
<body>
<div class="wrap">
<header class="top">
<a class="brand" href="${href('/replays', lang)}"><img src="${LOGO}" alt="" width="48" height="48"><span>Bacteria <em>Wars</em></span></a>
<nav aria-label="${text(lang, 'languageLabel')}"><a href="${href(head.path, other, head.params)}" hreflang="${other}" lang="${other}">${text(lang, 'language')}</a></nav>
</header>
<main>
${body}
</main>
<footer class="foot">
<a href="/">${text(lang, 'home')}</a>
<nav><a href="/${PRIVACY_POLICY_PATH}">${text(lang, 'privacy')}</a><a href="/${LEGAL_NOTICE_PATH}">${text(lang, 'legalNotice')}</a></nav>
</footer>
</div>
</body>
</html>
`;
}

/**
 * What a page that may be indexed adds to its head: robots, the canonical
 * URL and its language alternates, Open Graph and JSON-LD. `title` and
 * `description` come escaped.
 */
function indexed(
  head: Head,
  lang: Lang,
  title: string,
  description: string
): string {
  const url = (l: Lang) => escapeHtml(pageUrl(head.path, l, head.params));
  return `<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="${url(lang)}">
<link rel="alternate" hreflang="en" href="${url('en')}">
<link rel="alternate" hreflang="de" href="${url('de')}">
<link rel="alternate" hreflang="x-default" href="${url('en')}">
<meta property="og:type" content="${head.type}">
<meta property="og:site_name" content="Bacteria Wars">
<meta property="og:locale" content="${LOCALES[lang].replace('-', '_')}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${url(lang)}">
<meta property="og:image" content="${PREVIEW_IMAGE}">
<meta name="twitter:card" content="summary">
${head.jsonLd === undefined ? '' : `<script type="application/ld+json">${scriptJson(head.jsonLd)}</script>\n`}`;
}

/** The JSON-LD id of the game, which every page is `about`. */
export const GAME_JSONLD_ID = `${GAME_SITE_URL}/#game`;

/** The JSON-LD of the game itself, which every page is about. */
export function gameJsonLd(lang: Lang): Record<string, unknown> {
  return {
    '@type': 'VideoGame',
    '@id': GAME_JSONLD_ID,
    name: 'Bacteria Wars',
    url: `${GAME_SITE_URL}/`,
    image: PREVIEW_IMAGE,
    description: t(lang, 'about'),
    genre: 'Strategy',
    gamePlatform: ['Web browser', 'Android'],
    applicationCategory: 'Game',
    operatingSystem: 'Any',
    offers: { '@type': 'Offer', price: 0, priceCurrency: 'EUR' },
  };
}
