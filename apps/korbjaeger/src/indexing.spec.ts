// @vitest-environment node
import { readFileSync } from 'node:fs';

/** A file of the app, read as the server ships it. */
function appFile(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

/** One entry of `hosting.headers` in a Firebase config. */
interface HostingHeaders {
  source: string;
  headers: { key: string; value: string }[];
}

// ADR 0019: no page is indexed, and there is no sitemap.
describe('indexing', () => {
  it('marks every page noindex in the one HTML shell', () => {
    expect(appFile('index.html')).toMatch(
      /<meta name="robots" content="noindex" \/>/
    );
  });

  it('has Hosting mark every response noindex, files and proxy alike', () => {
    const hosting = (
      JSON.parse(appFile('../../firebase.korbjaeger.json')) as {
        hosting: { headers: HostingHeaders[] };
      }
    ).hosting;

    expect(hosting.headers).toContainEqual({
      source: '**',
      headers: [{ key: 'X-Robots-Tag', value: 'noindex' }],
    });
  });

  it('answers a missing file with a German 404 page of its own, noindex', () => {
    // Hosting serves it with status 404 for a path with an extension the
    // rewrite leaves alone (/gibtsnicht.html); a missing chunk stays a 404
    const seite = appFile('src/public/404.html');

    expect(seite).toMatch(/<html lang="de">/);
    expect(seite).toMatch(/<meta name="robots" content="noindex" \/>/);
    expect(seite).toContain('<title>Seite nicht gefunden · Korbjäger</title>');
    expect(seite).toContain('Diese Seite gibt es nicht (mehr).');
    expect(seite).toMatch(/<a href="\/">Zur Startseite<\/a>/);
  });

  it('lets crawlers in, so they can read the noindex', () => {
    // a URL robots.txt disallows is never fetched, nor its noindex read
    expect(appFile('src/public/robots.txt')).toBe('User-agent: *\nDisallow:\n');
  });

  it('names no sitemap', () => {
    expect(appFile('src/public/robots.txt')).not.toMatch(/sitemap/i);
  });
});
