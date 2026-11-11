import { TestBed } from '@angular/core/testing';
import { GameStorage } from './game-storage';
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

  it('skips a write that changes nothing', () => {
    storage.write('key', { a: 1 });
    const setItem = jest.spyOn(Storage.prototype, 'setItem');

    storage.write('key', { a: 1 });
    void storage.update('key', (stored) => stored);

    expect(setItem).not.toHaveBeenCalled();
  });

  it('updates the stored value with what the change makes of it', () => {
    void storage.update('count', (stored) => (stored == null ? 1 : 0));
    void storage.update('count', (stored) => (stored as number) + 1);
    expect(watched('count')).toEqual([2]);
  });

  it('says a change settled once it is stored', async () => {
    await expect(storage.update('count', () => 1)).resolves.toBe(true);
    await expect(storage.update('count', (stored) => stored)).resolves.toBe(
      true
    );
  });

  it('says a change the browser refused to store was dropped', async () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });

    await expect(storage.update('count', () => 1)).resolves.toBe(false);
  });

  it('says a change that threw was dropped, without throwing itself', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const failing = () => {
      throw new Error('broken change');
    };

    await expect(storage.update('count', failing)).resolves.toBe(false);
  });

  it('changes the value under a lock all tabs share, where there is one', async () => {
    const held: string[] = [];
    // As the browser's, it resolves with what the callback returns.
    const request = jest.fn(async (name: string, callback: () => unknown) => {
      held.push(name);
      return callback();
    });
    Object.defineProperty(navigator, 'locks', {
      value: { request },
      configurable: true,
    });
    try {
      await expect(storage.update('count', () => 1)).resolves.toBe(true);

      expect(held).toEqual(['bacteria-game-storage:count']);
      expect(watched('count')).toEqual([1]);
    } finally {
      Object.defineProperty(navigator, 'locks', {
        value: undefined,
        configurable: true,
      });
    }
  });

  it('still changes the value when the browser refuses the lock', async () => {
    Object.defineProperty(navigator, 'locks', {
      value: { request: () => Promise.reject(new Error('denied')) },
      configurable: true,
    });
    try {
      await expect(storage.update('count', () => 2)).resolves.toBe(true);

      expect(watched('count')).toEqual([2]);
    } finally {
      Object.defineProperty(navigator, 'locks', {
        value: undefined,
        configurable: true,
      });
    }
  });

  it('shrugs off a browser that refuses storage', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(() => storage.write('key', 1)).not.toThrow();
    expect(() => void storage.update('key', () => 1)).not.toThrow();
    expect(watched('key')).toEqual([null]);
  });
});
