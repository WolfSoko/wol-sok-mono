// @vitest-environment node
import { appSources, hits } from '../../testing/app-sources';
import { DEVICE_KEYS } from './device-keys';

const OLD_KEYS_FILE = 'keys-before-english-names.ts';

const KEYS = /['`](korbjaeger-[a-z:-]+)['`]/g;

describe('the device keys the privacy policy lists', () => {
  it('hold every localStorage key the app’s code names', () => {
    const inCode = new Set(
      appSources(['ts'])
        // the keys of before #2966, which the start only removes
        .filter(({ file }) => !file.endsWith(OLD_KEYS_FILE))
        .flatMap(({ content }) => hits(content, KEYS))
    );

    expect(inCode.size).toBeGreaterThan(0);
    expect([...inCode].sort()).toEqual(Object.values(DEVICE_KEYS).sort());
  });
});
