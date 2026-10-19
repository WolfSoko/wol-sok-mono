import { TestBed } from '@angular/core/testing';
import { GameStorage, isObject } from './game-storage';
import { LocalGameStorage } from './local-game-storage';

describe('LocalGameStorage', () => {
  let storage: GameStorage;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    storage = TestBed.inject(GameStorage);
  });
  afterEach(() => jest.restoreAllMocks());

  function watched(key: string): unknown[] {
    const values: unknown[] = [];
    storage.watch(key).subscribe((value) => values.push(value));
    return values;
  }

  function changeInAnotherTab(key: string | null, value?: unknown): void {
    if (key === null) {
      localStorage.clear();
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
    window.dispatchEvent(new StorageEvent('storage', { key }));
  }

  it('is the storage the game gets by default', () => {
    expect(storage).toBeInstanceOf(LocalGameStorage);
  });

  it('reads back what it wrote, at once', () => {
    storage.write('key', { a: [1, 2] });
    expect(watched('key')).toEqual([{ a: [1, 2] }]);
  });

  it('reads nothing from a missing or unreadable key', () => {
    expect(watched('missing')).toEqual([null]);
    localStorage.setItem('broken', '{not json');
    expect(watched('broken')).toEqual([null]);
  });

  it('passes on what another tab stores under the key', () => {
    const values = watched('key');

    changeInAnotherTab('other', 1);
    changeInAnotherTab('key', 2);
    changeInAnotherTab(null);

    expect(values).toEqual([null, 2, null]);
  });

  it('updates the stored value with what the change makes of it', () => {
    storage.update('count', (stored) => (stored == null ? 1 : 0));
    storage.update('count', (stored) => (stored as number) + 1);
    expect(watched('count')).toEqual([2]);
  });

  it('shrugs off a browser that refuses storage', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(() => storage.write('key', 1)).not.toThrow();
    expect(() => storage.update('key', () => 1)).not.toThrow();
    expect(watched('key')).toEqual([null]);
  });
});

describe('isObject', () => {
  it('tells objects from everything else', () => {
    expect(isObject({})).toBe(true);
    expect(isObject([])).toBe(true);
    expect(isObject(null)).toBe(false);
    expect(isObject('x')).toBe(false);
  });
});
