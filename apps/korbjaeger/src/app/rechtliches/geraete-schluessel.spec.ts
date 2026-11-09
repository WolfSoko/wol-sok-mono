// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GERAETE_SCHLUESSEL } from './geraete-schluessel';

const APP = fileURLToPath(new URL('..', import.meta.url));
const SCHLUESSEL = /['`](korbjaeger-[a-z:-]+)['`]/g;

/** The app's sources: no specs, emulator tests or test helpers. */
function quellen(ordner: string): string[] {
  return readdirSync(ordner, { withFileTypes: true }).flatMap((eintrag) => {
    const pfad = join(ordner, eintrag.name);
    if (eintrag.isDirectory()) {
      return quellen(pfad);
    }
    return /(?<!\.spec|\.emulator)\.ts$/.test(eintrag.name) ? [pfad] : [];
  });
}

describe('the device keys the privacy policy lists', () => {
  it('hold every localStorage key the app’s code names', () => {
    const imCode = new Set(
      quellen(APP).flatMap((pfad) =>
        [...readFileSync(pfad, 'utf8').matchAll(SCHLUESSEL)].map(
          (treffer) => treffer[1]
        )
      )
    );

    expect(imCode.size).toBeGreaterThan(0);
    expect([...imCode].sort()).toEqual(
      Object.values(GERAETE_SCHLUESSEL).sort()
    );
  });
});
