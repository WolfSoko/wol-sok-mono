// @vitest-environment node
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATENSCHUTZ_PFAD, IMPRESSUM_PFAD } from './rechtliche-pfade';

const SEITEN = fileURLToPath(new URL('../pages', import.meta.url));

describe('the legal pages’ paths', () => {
  it.each([DATENSCHUTZ_PFAD, IMPRESSUM_PFAD])(
    'has a page file for /%s, so a link to it never lands on "Seite nicht gefunden"',
    (pfad) => {
      expect(existsSync(join(SEITEN, `${pfad}.page.ts`))).toBe(true);
    }
  );
});
