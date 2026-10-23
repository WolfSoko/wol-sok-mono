import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { appRoutes } from './app/app.routes';

const SITE = 'https://bacteria-wars.wolsok.de';

const sitemap = readFileSync(join(__dirname, 'sitemap.xml'), 'utf8');
const listed = Array.from(sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)).map(
  (match) => match[1]
);

describe('sitemap of the game site', () => {
  it('lists the game and every page of its own', () => {
    // The game itself, then the legal pages the site's routes name.
    const pages = appRoutes.map((route) => `${SITE}/${route.path ?? ''}`);
    expect(listed.sort()).toEqual(pages.sort());
  });

  it('is what robots.txt points to', () => {
    const robots = readFileSync(join(__dirname, 'robots.txt'), 'utf8');
    expect(robots).toContain(`Sitemap: ${SITE}/sitemap.xml`);
  });
});
