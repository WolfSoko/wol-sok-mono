import { afterEach, describe, expect, it, vi } from 'vitest';
import { LOCAL_STORAGE_KEY_PREFIX, Repository } from './repository';

// Mock isPlatformBrowser
vi.mock('@angular/common', () => ({
  isPlatformBrowser: vi.fn(),
}));

type TestData = { foo: string };

const KEY = LOCAL_STORAGE_KEY_PREFIX + 'testKey';

describe('Repository', () => {
  function initRepository(saveToLocalStorage = true): Repository<TestData> {
    return new Repository('testKey', saveToLocalStorage);
  }

  afterEach(() => {
    // Clear localStorage after each test
    localStorage.clear();
  });

  it('should save data to localStorage in browser environment', () => {
    const service = initRepository(true);
    const testData = { foo: 'bar' };

    service.save(testData);

    thenDataWasSaved(testData);
  });

  it('should not save data to localStorage in non-browser environment', () => {
    const service = initRepository(false);
    const testData = { foo: 'bar' };

    service.save(testData);

    thenDataWasNotSaved();
  });

  it('should load data in browser environment', () => {
    const service = initRepository(true);

    const testData = { foo: 'test-bar' };
    localStorage.setItem(KEY, JSON.stringify(testData));

    const loadedData = service.load();

    expect(loadedData).toEqual(testData);
  });

  it('should return null when loading data in non-browser environment', () => {
    const service = initRepository(false);

    const loadedData = service.load();

    expect(loadedData).toBeNull();
  });

  it('should remove saved data on clear', () => {
    const service = initRepository(true);
    service.save({ foo: 'bar' });

    service.clear();

    expect(service.load()).toBeNull();
  });

  describe('when the browser refuses storage access', () => {
    afterEach(() => vi.restoreAllMocks());

    it('should keep working without saving', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('quota exceeded', 'QuotaExceededError');
      });
      const service = initRepository(true);

      expect(() => service.save({ foo: 'bar' })).not.toThrow();
    });

    it('should clear without failing', () => {
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError');
      });
      const service = initRepository(true);

      expect(() => service.clear()).not.toThrow();
    });

    it('should load nothing', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError');
      });
      const service = initRepository(true);

      expect(service.load()).toBeNull();
    });
  });

  it('should load nothing when the stored data is not JSON', () => {
    const service = initRepository(true);
    localStorage.setItem(KEY, '{not json');

    expect(service.load()).toBeNull();
  });

  function thenDataWasSaved(data: TestData) {
    expect(localStorage.getItem(KEY)).toEqual(JSON.stringify(data));
  }

  function thenDataWasNotSaved() {
    expect(localStorage.getItem(KEY)).toBeNull();
  }
});
