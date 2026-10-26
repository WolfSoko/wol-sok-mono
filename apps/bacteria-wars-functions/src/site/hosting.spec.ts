import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REGION } from '../config';
import { CACHE, SITEMAP_CACHE } from './public-site';

/**
 * Hosting sends `/replays` and `/replays/**` to `publicSite` (ADR 0011),
 * before the SPA's catch-all, with the cache the function sets. (The
 * remote's `sitemap.spec.ts` checks that robots.txt names the replays'
 * sitemap.)
 */
const ROOT = join(__dirname, '../../../..');
const hosting = JSON.parse(
  readFileSync(join(ROOT, 'firebase.bacteria-game-remote.json'), 'utf8')
).hosting as {
  rewrites: Record<string, unknown>[];
  headers: { source: string; headers: { key: string; value: string }[] }[];
};

describe('publicSite behind Hosting', () => {
  it('takes /replays and below, before the SPA', () => {
    const toSite = { functionId: 'publicSite', region: REGION };
    expect(hosting.rewrites).toEqual([
      { source: '/replays', function: toSite },
      { source: '/replays/**', function: toSite },
      { source: '**/!(*.*)', destination: '/index.html' },
    ]);
  });

  it("sends the function's cache, after the catch-all no-cache", () => {
    const cacheOf = (source: string) =>
      hosting.headers
        .filter((rule) => rule.source === source)
        .flatMap((rule) => rule.headers)
        .find((header) => header.key === 'Cache-Control')?.value;
    expect(cacheOf('/replays')).toBe(CACHE);
    expect(cacheOf('/replays/**')).toBe(CACHE);
    expect(cacheOf('/replays/sitemap.xml')).toBe(SITEMAP_CACHE);
    const sources = hosting.headers.map((rule) => rule.source);
    expect(sources.indexOf('**')).toBeLessThan(sources.indexOf('/replays'));
    expect(sources.indexOf('/replays/**')).toBeLessThan(
      sources.indexOf('/replays/sitemap.xml')
    );
  });
});
