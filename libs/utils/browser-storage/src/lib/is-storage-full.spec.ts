import { isStorageFull } from './is-storage-full';

describe('isStorageFull', () => {
  it.each(['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED'])(
    'is true for a DOMException named %s',
    (name) => {
      expect(isStorageFull(new DOMException('full', name))).toBe(true);
    }
  );

  it('is false for another DOMException', () => {
    expect(isStorageFull(new DOMException('denied', 'SecurityError'))).toBe(
      false
    );
  });

  it('is false for a plain error of the same name', () => {
    const error = new Error('full');
    error.name = 'QuotaExceededError';
    expect(isStorageFull(error)).toBe(false);
  });

  it('is false for what is no error', () => {
    expect(isStorageFull(undefined)).toBe(false);
  });
});
