import { describe, expect, it, vi } from 'vitest';
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

  function thenDataWasSaved(data: TestData) {
    expect(localStorage.getItem(KEY)).toEqual(JSON.stringify(data));
  }

  function thenDataWasNotSaved() {
    expect(localStorage.getItem(KEY)).toBeNull();
  }
});
