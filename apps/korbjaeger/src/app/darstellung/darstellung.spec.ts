// @vitest-environment node
import { readFileSync } from 'node:fs';
import { DARSTELLUNG_SCHLUESSEL } from '../geraete-speicher';

const INDEX_HTML = readFileSync(
  new URL('../../../index.html', import.meta.url),
  'utf8'
);

describe('the look before the first paint', () => {
  it('reads the key the settings store the look under', () => {
    expect(INDEX_HTML).toContain(
      `localStorage.getItem("${DARSTELLUNG_SCHLUESSEL}")`
    );
  });

  it('sets the look before the stylesheet loads', () => {
    expect(INDEX_HTML.indexOf('data-theme')).toBeLessThan(
      INDEX_HTML.indexOf('src/styles.scss')
    );
  });
});
