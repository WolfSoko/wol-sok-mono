import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GAME_SITE_URL } from '@wolsok/feat-lazy-bac-game';
import { appRoutes } from './app/app.routes';

const sitemap = readFileSync(join(__dirname, 'sitemap.xml'), 'utf8');
const listed = Array.from(sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)).map(
  (match) => match[1]
);

describe('sitemap of the game site', () => {
  it('lists the game and every page of its own', () => {
    // The game itself, then the legal pages: every route that renders a
    // page, not a redirect, a fallback or one kept out of search engines.
    const pages = appRoutes
      .filter(
        (route) =>
          route.redirectTo === undefined &&
          route.path !== '**' &&
          route.data?.['noindex'] !== true &&
          (route.component || route.loadComponent || route.loadChildren)
      )
      .map((route) => `${GAME_SITE_URL}/${route.path ?? ''}`);
    expect(listed.sort()).toEqual(pages.sort());
  });

  it('is what robots.txt points to', () => {
    const robots = readFileSync(join(__dirname, 'robots.txt'), 'utf8');
    expect(robots).toContain(`Sitemap: ${GAME_SITE_URL}/sitemap.xml`);
    // The public replays' own, served by the publicSite function.
    expect(robots).toContain(`Sitemap: ${GAME_SITE_URL}/replays/sitemap.xml`);
  });

  it('leaves out the pages robots.txt keeps out', () => {
    const robots = readFileSync(join(__dirname, 'robots.txt'), 'utf8');
    const hidden = appRoutes.filter(
      (route) => route.data?.['noindex'] === true
    );
    expect(hidden.map((route) => route.path)).toEqual([
      'watch/:publicId',
      'admin',
    ]);
    for (const route of hidden) {
      // A route with a parameter is kept out by its prefix: `/watch/`.
      const path = route.path ?? '';
      const cut = path.indexOf('/:');
      const prefix = cut === -1 ? path : path.slice(0, cut + 1);
      expect(robots).toContain(`Disallow: /${prefix}`);
      expect(
        listed.some((url) => url.startsWith(`${GAME_SITE_URL}/${prefix}`))
      ).toBe(false);
    }
  });
});
