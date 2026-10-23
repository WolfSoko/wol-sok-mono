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
    // page, not a redirect or a fallback.
    const pages = appRoutes
      .filter(
        (route) =>
          route.redirectTo === undefined &&
          route.path !== '**' &&
          (route.component || route.loadComponent || route.loadChildren)
      )
      .map((route) => `${GAME_SITE_URL}/${route.path ?? ''}`);
    expect(listed.sort()).toEqual(pages.sort());
  });

  it('is what robots.txt points to', () => {
    const robots = readFileSync(join(__dirname, 'robots.txt'), 'utf8');
    expect(robots).toContain(`Sitemap: ${GAME_SITE_URL}/sitemap.xml`);
  });
});
