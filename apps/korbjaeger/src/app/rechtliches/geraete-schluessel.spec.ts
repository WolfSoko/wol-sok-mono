// @vitest-environment node
import { appQuellen, treffer } from '../../testing/app-quellen';
import { GERAETE_SCHLUESSEL } from './geraete-schluessel';

const SCHLUESSEL = /['`](korbjaeger-[a-z:-]+)['`]/g;

describe('the device keys the privacy policy lists', () => {
  it('hold every localStorage key the app’s code names', () => {
    const imCode = new Set(
      appQuellen(['ts']).flatMap(({ inhalt }) => treffer(inhalt, SCHLUESSEL))
    );

    expect(imCode.size).toBeGreaterThan(0);
    expect([...imCode].sort()).toEqual(
      Object.values(GERAETE_SCHLUESSEL).sort()
    );
  });
});
