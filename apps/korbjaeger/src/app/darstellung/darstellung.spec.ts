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

  it('sets the look in a classic script before the stylesheet loads', () => {
    const vorDemStylesheet = INDEX_HTML.slice(
      0,
      INDEX_HTML.indexOf('src/styles.scss')
    );
    expect(vorDemStylesheet).toMatch(
      /<script>[^<]*setAttribute\("data-theme", t\)[^<]*<\/script>/
    );
  });
});
