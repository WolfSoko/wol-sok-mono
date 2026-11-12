import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// AdMob verifies the Bacteria Wars app's ad sellers through app-ads.txt at the
// root of the developer website its Play listing names (#3078); the seller is
// the same as the site's own ads.txt names.
const publicFile = (name: string): string =>
  readFileSync(join(__dirname, '../public', name), 'utf8');

describe('app-ads.txt of wolsok.de', () => {
  it('names exactly the seller ads.txt names', () => {
    expect(publicFile('app-ads.txt')).toBe(publicFile('ads.txt'));
    expect(publicFile('app-ads.txt')).toBe(
      'google.com, pub-6346271540341424, DIRECT, f08c47fec0942fa0\n'
    );
  });
});
