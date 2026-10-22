import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The privacy policy the Play listing and the game's help screen link to.
const page = readFileSync(join(__dirname, 'privacy.html'), 'utf8');

describe('privacy policy', () => {
  it('loads nothing from other hosts, so reading it sends nobody data', () => {
    // Everything the browser fetches by itself: src and srcset of any
    // element, href of a <link>, url() and @import in the styles. Links a
    // reader follows (<a href>) are not fetched.
    const loads = [
      ...page.matchAll(/\b(?:src|srcset)\s*=\s*["']?([^"'\s>]*)/gi),
      ...page.matchAll(/<link\b[^>]*\bhref\s*=\s*["']?([^"'\s>]*)/gi),
      ...page.matchAll(/url\(\s*['"]?([^'")]*)/gi),
      ...page.matchAll(/@import\s+['"]([^'"]*)/gi),
    ].map(([, url]) => url);
    const external = loads.filter(
      (url) =>
        /^(https?:)?\/\//i.test(url) &&
        !url.startsWith('https://bacteria-game.wolsok.de/')
    );

    expect(loads.length).toBeGreaterThan(0);
    expect(external).toEqual([]);
  });

  it('is in German and English', () => {
    expect(page).toContain('<article id="de" lang="de">');
    expect(page).toContain('<article id="en" lang="en">');
  });
});
