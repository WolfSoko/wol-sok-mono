// @vitest-environment node
import { appQuellen, treffer } from '../../testing/app-quellen';
import { LEGACY_DEVICE_KEYS } from '../legacy-device-keys';
import { GERAETE_SCHLUESSEL } from './geraete-schluessel';

const SCHLUESSEL = /['`](korbjaeger-[a-z:-]+)['`]/g;

describe('the device keys the privacy policy lists', () => {
  it('hold every localStorage key the app’s code names', () => {
    const imCode = new Set(
      appQuellen(['ts']).flatMap(({ inhalt }) => treffer(inhalt, SCHLUESSEL))
    );

    // the keys before #2966, which the start only reads and removes
    for (const legacy of Object.values(LEGACY_DEVICE_KEYS)) {
      imCode.delete(legacy);
    }

    expect(imCode.size).toBeGreaterThan(0);
    expect([...imCode].sort()).toEqual(
      Object.values(GERAETE_SCHLUESSEL).sort()
    );
  });
});
