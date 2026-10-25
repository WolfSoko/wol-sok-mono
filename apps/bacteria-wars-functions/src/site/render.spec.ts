import {
  escapeHtml,
  galleryPage,
  type PublicView,
  replayPage,
  scriptJson,
  sitemap,
  SITE_URL,
} from './render';

const view = (fields: Partial<PublicView> = {}): PublicView => ({
  id: 'AbCdEfGhIjKlMnOpQrSt',
  levelId: 'quarantine',
  kind: 'computer',
  players: [
    { label: 'orange', name: '<Ada & "Co">', colorId: 'orange' },
    { label: 'computer', name: null, colorId: 'blue' },
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

  it('sets the canonical URL, the language alternates and the viewer link', () => {
    const page = replayPage('de', view());
    expect(page).toContain('<html lang="de">');
    expect(page).toContain(
      `<link rel="canonical" href="${SITE_URL}/replays/AbCdEfGhIjKlMnOpQrSt?lang=de">`
    );
    expect(page).toContain(
      `hreflang="en" href="${SITE_URL}/replays/AbCdEfGhIjKlMnOpQrSt"`
    );
    expect(page).toContain('hreflang="x-default"');
    expect(page).toContain('href="/watch/AbCdEfGhIjKlMnOpQrSt"');
    expect(page).toContain('Match des Tages: Quarantäne');
    expect(page).toContain('<polyline');
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
});

describe('sitemap', () => {
  it('lists the gallery and each replay', () => {
    const xml = sitemap([view()]);
    expect(xml).toContain(`<loc>${SITE_URL}/replays</loc>`);
    expect(xml).toContain(
      `<loc>${SITE_URL}/replays/AbCdEfGhIjKlMnOpQrSt</loc><lastmod>2026-10-26</lastmod>`
    );
  });
});
