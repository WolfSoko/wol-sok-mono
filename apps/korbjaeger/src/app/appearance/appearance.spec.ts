// @vitest-environment node
import { readFileSync } from 'node:fs';
import { APPEARANCE_KEY } from '../device-storage';

const INDEX_HTML = readFileSync(
  new URL('../../../index.html', import.meta.url),
  'utf8'
);

describe('the look before the first paint', () => {
  it('reads the key the settings store the look under', () => {
    expect(INDEX_HTML).toContain(`localStorage.getItem("${APPEARANCE_KEY}")`);
  });

  it('sets the look in a classic script before the stylesheet loads', () => {
    const beforeStylesheet = INDEX_HTML.slice(
      0,
      INDEX_HTML.indexOf('src/styles.scss')
    );
    expect(beforeStylesheet).toMatch(
      /<script>[^<]*setAttribute\("data-theme", t\)[^<]*<\/script>/
    );
  });
});
