import { GAME_SITE_URL as SITE_URL } from '@wolsok/feat-shared-bacteria-engine';
import { escapeHtml, scriptJson } from './html';
import {
  galleryPage,
  replayPage,
  type ReplayView,
  sitemap,
  SITEMAP_REPLAYS,
  statusPage,
} from './render';

const view = (fields: Partial<ReplayView> = {}): ReplayView => ({
  id: 'AbCdEfGhIjKlMnOpQrSt',
  levelId: 'quarantine',
  kind: 'computer',
  players: [
    {
      label: 'orange',
      name: '<Ada & "Co">',
      colorId: 'orange',
      avatarPreset: 1,
    },
    { label: 'computer', name: null, colorId: 'blue', avatarPreset: 0 },
  ],
  ticks: 90 * 60,
  endedBy: 'annihilation',
  winnerSeat: 0,
  score: 75,
  reasons: ['close', 'comeback'],
  summary: { sizes: [10, 8], timeline: [8, 10, 10, 8, 12, 4] },
  featuredAt: Date.UTC(2026, 9, 26),
  ...fields,
});

/** The page's head and body apart. */
const parts = (page: string) => {
  const [head, body] = page.split('</head>');
  return { head: head ?? '', body: body ?? '' };
};

describe('escaping', () => {
  it('escapes text and attributes, and </ in JSON for a script', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;'
    );
    expect(scriptJson({ a: '</script>' })).toBe('{"a":"\\u003c/script>"}');
  });
});

describe('replayPage', () => {
  it('shows names in the body only, escaped, never in the head', () => {
    const { head, body } = parts(replayPage('en', view()));
    expect(head).not.toContain('Ada');
    expect(head).toContain(
      '<title>Match of the day: Quarantine | Bacteria Wars</title>'
    );
    expect(head).toContain('Orange colony won');
    expect(body).toContain('&lt;Ada &amp; &quot;Co&quot;&gt; won');
    expect(body).not.toContain('<Ada');
  });

  it('sets the canonical URL and the language alternates', () => {
    const page = replayPage('de', view());
    expect(page).toContain('<html lang="de">');
    expect(page).toContain(
      `<link rel="canonical" href="${SITE_URL}/replays/AbCdEfGhIjKlMnOpQrSt?lang=de">`
    );
    expect(page).toContain(
      `hreflang="en" href="${SITE_URL}/replays/AbCdEfGhIjKlMnOpQrSt"`
    );
    expect(page).toContain('hreflang="x-default"');
    expect(page).toContain('Match des Tages: Quarantäne');
    expect(page).toContain('<polyline');
  });

  it('links the match to the watch page, which plays it back', () => {
    expect(parts(replayPage('en', view())).body).toContain(
      '<a class="button primary" href="/watch/AbCdEfGhIjKlMnOpQrSt">▶ Watch the match</a>'
    );
    // The watch page follows the browser's language, not `?lang`.
    expect(parts(replayPage('de', view())).body).toContain(
      '<a class="button primary" href="/watch/AbCdEfGhIjKlMnOpQrSt">▶ Match ansehen</a>'
    );
  });

  it('calls a draw a draw', () => {
    expect(parts(replayPage('en', view({ winnerSeat: null }))).head).toContain(
      'Draw'
    );
  });
});

describe('galleryPage', () => {
  it('links every replay in its language, and says so when there is none', () => {
    expect(galleryPage('de', [view()])).toContain(
      'href="/replays/AbCdEfGhIjKlMnOpQrSt?lang=de"'
    );
    expect(galleryPage('en', [])).toContain('No match has been picked yet.');
  });

  it('links the older matches where there are more', () => {
    expect(galleryPage('de', [view()], '123_AbCdEfGhIjKlMnOpQrSt')).toContain(
      'href="/replays?before=123_AbCdEfGhIjKlMnOpQrSt&amp;lang=de">Ältere Matches'
    );
    expect(galleryPage('en', [view()])).not.toContain('Older matches');
  });

  it('makes each page of the gallery its own canonical URL', () => {
    const { head } = parts(
      galleryPage('de', [view()], null, '123_AbCdEfGhIjKlMnOpQrSt')
    );
    expect(head).toContain(
      `<link rel="canonical" href="${SITE_URL}/replays?before=123_AbCdEfGhIjKlMnOpQrSt&amp;lang=de">`
    );
    expect(parts(galleryPage('en', [view()])).head).toContain(
      `<link rel="canonical" href="${SITE_URL}/replays">`
    );
  });

  it('keeps a page past the last replay out of the index', () => {
    const { head } = parts(
      galleryPage('en', [], null, '1_AbCdEfGhIjKlMnOpQrSt')
    );
    expect(head).toContain('<meta name="robots" content="noindex">');
    expect(parts(galleryPage('en', [])).head).toContain('index, follow');
  });

  it('is indexed, with a preview image and the replays as a list', () => {
    const { head } = parts(galleryPage('en', [view()]));
    expect(head).toContain(
      '<meta name="robots" content="index, follow, max-image-preview:large">'
    );
    expect(head).toContain(
      `<meta property="og:image" content="${SITE_URL}/icons/icon-512.png">`
    );
    const ld = JSON.parse(
      /<script type="application\/ld\+json">(.*?)<\/script>/.exec(head)?.[1] ??
        '{}'
    ) as { '@graph': { '@type': string; mainEntity?: unknown }[] };
    expect(ld['@graph'].map((node) => node['@type'])).toEqual([
      'CollectionPage',
      'VideoGame',
    ]);
    expect(ld['@graph'][0]?.mainEntity).toEqual({
      '@type': 'ItemList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          url: `${SITE_URL}/replays/AbCdEfGhIjKlMnOpQrSt`,
        },
      ],
    });
  });

  it("wears the game's look: its logo, faces and legal links", () => {
    const page = galleryPage('en', [view()]);
    expect(page).toContain('src="/icons/icon-192.png"');
    expect(page).toContain(
      '<link rel="preload" href="/fonts/bricolage-grotesque-latin-800-normal.woff2"'
    );
    expect(page).toContain('href="/privacy"');
    expect(page).toContain('href="/impressum"');
    expect(page).toContain(
      '<time datetime="2026-10-26">Picked on 26 Oct 2026</time>'
    );
  });
});

describe('a replay without its pick date', () => {
  it('names no date rather than 1970', () => {
    const page = replayPage('en', view({ featuredAt: 0 }));
    expect(page).not.toContain('1970');
    expect(page).not.toContain('datePublished');
  });
});

describe('statusPage', () => {
  it('is never indexed and has no canonical', () => {
    const { head, body } = parts(statusPage(410, 'de', 'removed', '/replays'));
    expect(head).toContain('<meta name="robots" content="noindex">');
    expect(head).not.toContain('canonical');
    expect(body).toContain('Dieses Match ist nicht mehr öffentlich.');
  });

  it('switches language on the page asked for', () => {
    expect(
      statusPage(410, 'de', 'removed', '/replays/AbCdEfGhIjKlMnOpQrSt')
    ).toContain('href="/replays/AbCdEfGhIjKlMnOpQrSt" hreflang="en"');
  });
});

describe('sitemap', () => {
  it('stays within the 50,000 URLs a sitemap may hold', () => {
    const many = Array.from({ length: SITEMAP_REPLAYS + 5 }, (_, i) => ({
      id: `r${i}`,
      featuredAt: 0,
    }));
    const urls = sitemap(many).match(/<url>/g) ?? [];
    expect(urls.length).toBeLessThanOrEqual(50_000);
    expect(urls.length).toBe(2 * (SITEMAP_REPLAYS + 1));
  });

  it('lists the gallery and each replay, in both languages', () => {
    const xml = sitemap([view()]);
    expect(xml).toContain(`<loc>${SITE_URL}/replays</loc>`);
    expect(xml).toContain(`<loc>${SITE_URL}/replays?lang=de</loc>`);
    expect(xml).toContain(
      `<loc>${SITE_URL}/replays/AbCdEfGhIjKlMnOpQrSt</loc><lastmod>2026-10-26</lastmod>`
    );
    expect(xml).toContain(
      `<xhtml:link rel="alternate" hreflang="de" href="${SITE_URL}/replays/AbCdEfGhIjKlMnOpQrSt?lang=de"/>`
    );
  });
});
