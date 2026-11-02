import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The PWA's service worker answers navigations with the cached
 * `index.html`; the public replay pages are the `publicSite` function's
 * (Hosting rewrites `/replays` and below), so it lets them through to the
 * network, keeping Angular's defaults for the rest.
 */
describe('service worker', () => {
  const config = JSON.parse(
    readFileSync(join(__dirname, '../ngsw-config.json'), 'utf8')
  ) as { navigationUrls?: string[] };

  it("leaves the public replay pages to the network, the SPA's defaults to itself", () => {
    expect(config.navigationUrls).toEqual([
      '/**',
      '!/**/*.*',
      '!/**/*__*',
      '!/**/*__*/**',
      '!/replays',
      '!/replays/**',
    ]);
  });
});
