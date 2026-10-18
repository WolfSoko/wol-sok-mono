import { isObject, readStoredJson, storeJson } from './storage';

describe('storage', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => jest.restoreAllMocks());

  it('reads back what it stored', () => {
    storeJson('key', { a: [1, 2] });
    expect(readStoredJson('key')).toEqual({ a: [1, 2] });
  });

  it('reads nothing from a missing or unreadable key', () => {
    expect(readStoredJson('missing')).toBeNull();
    localStorage.setItem('broken', '{not json');
    expect(readStoredJson('broken')).toBeNull();
  });

  it('shrugs off a browser that refuses storage', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(() => storeJson('key', 1)).not.toThrow();
    expect(readStoredJson('key')).toBeNull();
  });

  it('tells objects from everything else', () => {
    expect(isObject({})).toBe(true);
    expect(isObject([])).toBe(true);
    expect(isObject(null)).toBe(false);
    expect(isObject('x')).toBe(false);
  });
});
