import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Inter ships with the app (Fontsource): a stylesheet or preconnect to
 * Google Fonts would hand every visitor's IP address to Google.
 */
const GOOGLE_FONTS_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

function appFile(path: string): string {
  return readFileSync(join(__dirname, path), 'utf8');
}

describe('the fonts', () => {
  it('load nothing from Google Fonts', () => {
    const indexHtml = appFile('../index.html');
    for (const host of GOOGLE_FONTS_HOSTS) {
      expect(indexHtml).not.toContain(host);
    }
  });

  it('take Inter from Fontsource', () => {
    expect(appFile('styles.scss')).toMatch(
      /^@import '@fontsource\/inter\/latin-400\.css';$/m
    );
  });
});
