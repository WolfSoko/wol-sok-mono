// @vitest-environment node
import { appQuellen, treffer } from '../../testing/app-quellen';
import { GERAETE_SCHLUESSEL } from './geraete-schluessel';

const OLD_KEYS_FILE = 'keys-before-english-names.ts';

const SCHLUESSEL = /['`](korbjaeger-[a-z:-]+)['`]/g;

describe('the device keys the privacy policy lists', () => {
  it('hold every localStorage key the app’s code names', () => {
    const imCode = new Set(
      appQuellen(['ts'])
        // the keys of before #2966, which the start only removes
        .filter(({ datei }) => !datei.endsWith(OLD_KEYS_FILE))
        .flatMap(({ inhalt }) => treffer(inhalt, SCHLUESSEL))
    );

    expect(imCode.size).toBeGreaterThan(0);
    expect([...imCode].sort()).toEqual(
      Object.values(GERAETE_SCHLUESSEL).sort()
    );
  });
});
