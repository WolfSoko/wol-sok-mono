// @vitest-environment node
import { appQuellen, treffer } from '../../testing/app-quellen';
import { KEYS_BEFORE_ENGLISH_NAMES } from '../keys-before-english-names';
import { GERAETE_SCHLUESSEL } from './geraete-schluessel';

const SCHLUESSEL = /['`](korbjaeger-[a-z:-]+)['`]/g;

describe('the device keys the privacy policy lists', () => {
  it('hold every localStorage key the app’s code names', () => {
    const imCode = new Set(
      appQuellen(['ts']).flatMap(({ inhalt }) => treffer(inhalt, SCHLUESSEL))
    );

    // the keys of before #2966, which the start only removes
    for (const old of Object.values(KEYS_BEFORE_ENGLISH_NAMES)) {
      imCode.delete(old);
    }

    expect(imCode.size).toBeGreaterThan(0);
    expect([...imCode].sort()).toEqual(
      Object.values(GERAETE_SCHLUESSEL).sort()
    );
  });
});
