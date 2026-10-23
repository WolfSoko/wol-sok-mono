import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { appRoutes } from './app/app.routes';
import { SITE_ORIGIN } from './app/legal/legal-page';

const sitemap = readFileSync(join(__dirname, 'sitemap.xml'), 'utf8');
const listed = Array.from(sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)).map(
  (match) => match[1]
);

describe('sitemap of the game site', () => {
  it('lists the game and every page of its own', () => {
    // The game itself, then the legal pages the site's routes name.
    const pages = appRoutes.map(
      (route) => `${SITE_ORIGIN}/${route.path ?? ''}`
    );
    expect(listed.sort()).toEqual(pages.sort());
  });

  it('is what robots.txt points to', () => {
    const robots = readFileSync(join(__dirname, 'robots.txt'), 'utf8');
    expect(robots).toContain(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`);
  });
});
