import { BLOCKED_STORAGE, mapStorage } from '../testing/storage';
import { SIGNED_IN_KEY, isFlagSet, setFlag } from './device-storage';

describe('the device flags', () => {
  it('sets a flag as "1" and clears it', () => {
    const storage = mapStorage();

    setFlag(storage, SIGNED_IN_KEY, true);
    expect(storage.getItem(SIGNED_IN_KEY)).toBe('1');
    expect(isFlagSet(storage, SIGNED_IN_KEY)).toBe(true);

    setFlag(storage, SIGNED_IN_KEY, false);
    expect(isFlagSet(storage, SIGNED_IN_KEY)).toBe(false);
  });

  it('takes only "1" for set', () => {
    const storage = mapStorage();
    storage.setItem(SIGNED_IN_KEY, 'ja');

    expect(isFlagSet(storage, SIGNED_IN_KEY)).toBe(false);
  });

  it('reads no flag and stores none where the device withholds its storage', () => {
    expect(isFlagSet(BLOCKED_STORAGE, SIGNED_IN_KEY)).toBe(false);
    expect(() => setFlag(BLOCKED_STORAGE, SIGNED_IN_KEY, true)).not.toThrow();
    expect(isFlagSet(undefined, SIGNED_IN_KEY)).toBe(false);
  });

  it('stores no flag and fails nothing where the storage is full', () => {
    const full = mapStorage();
    full.setItem = () => {
      throw new DOMException('full', 'QuotaExceededError');
    };

    expect(() => setFlag(full, SIGNED_IN_KEY, true)).not.toThrow();
    expect(isFlagSet(full, SIGNED_IN_KEY)).toBe(false);
  });
});
