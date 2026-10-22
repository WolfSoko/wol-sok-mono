import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The privacy policy the Play listing and the game's help screen link to.
const page = readFileSync(join(__dirname, 'privacy.html'), 'utf8');

describe('privacy policy', () => {
  it('loads nothing from other hosts, so reading it sends nobody data', () => {
    const loads = [...page.matchAll(/<(?:link|script|img)\b[^>]*>/g)].map(
      ([tag]) => /(?:href|src)="([^"]*)"/.exec(tag)?.[1] ?? ''
    );
    const external = loads.filter(
      (url) =>
        /^(https?:)?\/\//.test(url) &&
        !url.startsWith('https://bacteria-game.wolsok.de/')
    );

    expect(external).toEqual([]);
  });

  it('is in German and English', () => {
    expect(page).toContain('<article id="de" lang="de">');
    expect(page).toContain('<article id="en" lang="en">');
  });
});
