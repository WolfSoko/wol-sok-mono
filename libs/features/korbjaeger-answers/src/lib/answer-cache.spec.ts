import {
  ANSWER_INDEX,
  ANSWER_PREFIX,
  LocalAnswerCache,
  MAX_AGE_MS,
  type AnswerStorage,
  type CachedAnswer,
} from './answer-cache';

/** A key the app keeps beside the answers (Meine Teams); the store never touches it. */
const OTHER_KEY = 'meine-teams';

/** A `localStorage` that takes at most `zeichen` characters, keys and values. */
class SmallStorage implements AnswerStorage {
  public readonly eintraege = new Map<string, string>();

  public constructor(private readonly characters = Number.POSITIVE_INFINITY) {}

  public get length(): number {
    return this.eintraege.size;
  }

  public key(index: number): string | null {
    return [...this.eintraege.keys()][index] ?? null;
  }

  public getItem(key: string): string | null {
    return this.eintraege.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    const ohne = [...this.eintraege].filter(([k]) => k !== key);
    const used = ohne.reduce((sum, [k, v]) => sum + k.length + v.length, 0);
    if (used + key.length + value.length > this.characters) {
      throw new DOMException(
        'The quota has been exceeded.',
        'QuotaExceededError'
      );
    }
    this.eintraege.set(key, value);
  }

  public removeItem(key: string): void {
    this.eintraege.delete(key);
  }
}

const TEAM = '/api/dbb/team/313036/spiele';
const STANDINGS = '/api/dbb/liga/54862/tabelle';
const GAME = '/api/dbb/spiel/2861436';

/** When the specs read: shortly after every answer they store. */
const NOW = 10_000;
const MINUTE = 60_000;

function answer(
  storedAt: number,
  data: unknown = { status: '0' }
): CachedAnswer {
  return { answer: data, storedAt };
}

/** The paths `antworten` still has a last good answer for. */
function kept(cache: LocalAnswerCache, paths: readonly string[]): string[] {
  return paths.filter((path) => cache.read(path, NOW) !== undefined);
}

describe('LokaleLetzteAntworten', () => {
  it('gives back the last good answer of a path, with when it was stored', () => {
    const cache = new LocalAnswerCache(new SmallStorage());

    cache.store(TEAM, 'team-games', answer(1000, { data: [1] }));
    cache.store(TEAM, 'team-games', answer(2000, { data: [2] }));

    expect(cache.read(TEAM, NOW)).toEqual(answer(2000, { data: [2] }));
    expect(cache.read(STANDINGS, NOW)).toBeUndefined();
  });

  it('keeps them across visits, in the device storage', () => {
    const storage = new SmallStorage();
    new LocalAnswerCache(storage).store(TEAM, 'team-games', answer(1000));

    expect(new LocalAnswerCache(storage).read(TEAM, NOW)).toEqual(answer(1000));
  });

  describe('age', () => {
    it('serves an answer up to seven days old', () => {
      const cache = new LocalAnswerCache(new SmallStorage());
      cache.store(TEAM, 'team-games', answer(0));

      expect(cache.read(TEAM, MAX_AGE_MS)).toEqual(answer(0));
      expect(MAX_AGE_MS).toBe(7 * 24 * 60 * MINUTE);
    });

    it('serves no answer seven days and a minute old, and deletes it', () => {
      const storage = new SmallStorage();
      const cache = new LocalAnswerCache(storage);
      cache.store(TEAM, 'team-games', answer(0));

      expect(cache.read(TEAM, MAX_AGE_MS + MINUTE)).toBeUndefined();
      expect(storage.getItem(`${ANSWER_PREFIX}${TEAM}`)).toBeNull();
    });

    it('clears answers too old, of kinds no longer kept and of older versions', () => {
      const storage = new SmallStorage();
      const cache = new LocalAnswerCache(storage);
      cache.store(TEAM, 'team-games', answer(0));
      cache.store(STANDINGS, 'standings', answer(MAX_AGE_MS));
      cache.store(GAME, 'game-report', answer(MAX_AGE_MS));
      storage.setItem(
        `${ANSWER_PREFIX}/api/dbb/liga/1/tabelle`,
        JSON.stringify({ v: 1, am: MAX_AGE_MS, antwort: {} })
      );

      cache.cleanUp(MAX_AGE_MS + MINUTE, new Set(['standings']));

      expect(
        [...storage.eintraege.keys()].filter((key) =>
          key.startsWith(ANSWER_PREFIX)
        )
      ).toEqual([`${ANSWER_PREFIX}${STANDINGS}`]);
    });
  });

  describe('limits', () => {
    it('evicts the oldest answers once it holds as many as it may', () => {
      const cache = new LocalAnswerCache(new SmallStorage(), {
        entries: 2,
      });

      cache.store(STANDINGS, 'standings', answer(2000));
      cache.store(TEAM, 'team-games', answer(1000));
      cache.store(GAME, 'game-info', answer(3000));

      expect(kept(cache, [TEAM, STANDINGS, GAME])).toEqual([STANDINGS, GAME]);
    });

    it('counts a path stored again once', () => {
      const cache = new LocalAnswerCache(new SmallStorage(), {
        entries: 2,
      });

      cache.store(TEAM, 'team-games', answer(1000));
      cache.store(STANDINGS, 'standings', answer(2000));
      cache.store(TEAM, 'team-games', answer(3000));

      expect(kept(cache, [TEAM, STANDINGS])).toEqual([TEAM, STANDINGS]);
    });

    it('evicts the oldest answers once they hold more characters than they may', () => {
      const cache = new LocalAnswerCache(new SmallStorage(), {
        characters: 250,
      });
      const big = { data: 'x'.repeat(100) };

      cache.store(TEAM, 'team-games', answer(1000, big));
      cache.store(STANDINGS, 'standings', answer(2000, big));

      expect(kept(cache, [TEAM, STANDINGS])).toEqual([STANDINGS]);
    });

    it('keeps no answer larger than all of them may be, and drops the older one of its path', () => {
      const cache = new LocalAnswerCache(new SmallStorage(), {
        characters: 250,
      });
      cache.store(STANDINGS, 'standings', answer(1000));
      cache.store(TEAM, 'team-games', answer(1500));

      cache.store(TEAM, 'team-games', answer(2000, { data: 'x'.repeat(300) }));

      expect(kept(cache, [TEAM, STANDINGS])).toEqual([STANDINGS]);
    });

    it('makes room in a full storage by evicting its oldest answers', () => {
      const cache = new LocalAnswerCache(new SmallStorage(2600));
      const data = { data: 'x'.repeat(1000) };

      cache.store(TEAM, 'team-games', answer(1000, data));
      cache.store(STANDINGS, 'standings', answer(2000, data));
      cache.store(GAME, 'game-info', answer(3000, data));

      expect(kept(cache, [TEAM, STANDINGS, GAME])).toEqual([STANDINGS, GAME]);
    });

    it('never evicts what the app keeps beside them, and gives up when that fills the storage', () => {
      const storage = new SmallStorage(120);
      storage.setItem(OTHER_KEY, 'x'.repeat(100));
      const cache = new LocalAnswerCache(storage);

      expect(() => cache.store(TEAM, 'team-games', answer(1000))).not.toThrow();

      expect(cache.read(TEAM, NOW)).toBeUndefined();
      expect(storage.getItem(OTHER_KEY)).toHaveLength(100);
    });

    it('drops the older answer of a path whose new one the full storage does not take', () => {
      const storage = new SmallStorage(700);
      storage.setItem(OTHER_KEY, 'x'.repeat(400));
      const cache = new LocalAnswerCache(storage);
      cache.store(TEAM, 'team-games', answer(1000));
      expect(cache.read(TEAM, NOW)).toBeDefined();

      cache.store(TEAM, 'team-games', answer(2000, { data: 'x'.repeat(300) }));

      expect(cache.read(TEAM, NOW)).toBeUndefined();
    });

    it('evicts nothing for a storage that refuses writes for another reason', () => {
      const storage = new SmallStorage();
      const cache = new LocalAnswerCache(storage);
      cache.store(STANDINGS, 'standings', answer(1000));
      vi.spyOn(storage, 'setItem').mockImplementation(() => {
        throw new DOMException('denied', 'SecurityError');
      });

      cache.store(TEAM, 'team-games', answer(2000));

      expect(kept(cache, [TEAM, STANDINGS])).toEqual([STANDINGS]);
    });
  });

  it('evicts nothing for a write the storage refuses for another reason, even at its limit', () => {
    const storage = new SmallStorage();
    const cache = new LocalAnswerCache(storage, { entries: 2 });
    cache.store(TEAM, 'team-games', answer(1000));
    cache.store(STANDINGS, 'standings', answer(2000));
    const schreiben = storage.setItem.bind(storage);
    vi.spyOn(storage, 'setItem').mockImplementation((key, value) => {
      if (key === `${ANSWER_PREFIX}${GAME}`) {
        throw new DOMException('denied', 'SecurityError');
      }
      schreiben(key, value);
    });

    cache.store(GAME, 'game-info', answer(3000));

    expect(kept(cache, [TEAM, STANDINGS, GAME])).toEqual([TEAM, STANDINGS]);
  });

  it('gives all its room away for what must not give way (Meine Teams)', () => {
    const storage = new SmallStorage();
    storage.setItem(OTHER_KEY, '{}');
    const cache = new LocalAnswerCache(storage);
    cache.store(TEAM, 'team-games', answer(1000));
    cache.store(STANDINGS, 'standings', answer(2000));

    cache.clear();

    expect([...storage.eintraege.keys()]).toEqual([OTHER_KEY]);
    expect(kept(cache, [TEAM, STANDINGS])).toEqual([]);
    cache.store(GAME, 'game-info', answer(3000));
    expect(kept(cache, [GAME])).toEqual([GAME]);
  });

  describe('its index', () => {
    it('parses the stored index once for writes in a row', () => {
      const storage = new SmallStorage();
      new LocalAnswerCache(storage).store(TEAM, 'team-games', answer(1000));
      const cache = new LocalAnswerCache(storage);
      const parsed = vi.spyOn(JSON, 'parse');

      cache.store(STANDINGS, 'standings', answer(2000));
      cache.store(GAME, 'game-info', answer(3000));

      expect(parsed).toHaveBeenCalledTimes(1);
    });

    it('reads the index again once another tab changed it', () => {
      const storage = new SmallStorage();
      const here = new LocalAnswerCache(storage, { entries: 2 });
      const there = new LocalAnswerCache(storage, { entries: 2 });
      here.store(TEAM, 'team-games', answer(1000));
      there.store(STANDINGS, 'standings', answer(2000));

      here.store(GAME, 'game-info', answer(3000));

      expect(kept(here, [TEAM, STANDINGS, GAME])).toEqual([STANDINGS, GAME]);
    });

    it('reads no stored answer for a write within the limits', () => {
      const storage = new SmallStorage();
      const cache = new LocalAnswerCache(storage);
      cache.store(TEAM, 'team-games', answer(1000));
      const gelesen = vi.spyOn(storage, 'getItem');

      cache.store(STANDINGS, 'standings', answer(2000));
      cache.store(GAME, 'game-info', answer(3000));

      expect(
        gelesen.mock.calls.filter(([key]) => key !== ANSWER_INDEX)
      ).toEqual([]);
    });

    it('counts no answer deleted behind its back', () => {
      const storage = new SmallStorage();
      const cache = new LocalAnswerCache(storage, { entries: 2 });
      cache.store(TEAM, 'team-games', answer(1000));
      cache.store(STANDINGS, 'standings', answer(2000));
      storage.removeItem(`${ANSWER_PREFIX}${TEAM}`);

      cache.store(GAME, 'game-info', answer(3000));

      expect(kept(cache, [STANDINGS, GAME])).toEqual([STANDINGS, GAME]);
    });

    it('rebuilds itself from the answers when it cannot be read', () => {
      const storage = new SmallStorage();
      const cache = new LocalAnswerCache(storage, { entries: 2 });
      cache.store(STANDINGS, 'standings', answer(2000));
      cache.store(TEAM, 'team-games', answer(1000));
      storage.setItem(ANSWER_INDEX, '{kaputt');

      cache.store(GAME, 'game-info', answer(3000));

      expect(kept(cache, [TEAM, STANDINGS, GAME])).toEqual([STANDINGS, GAME]);
    });

    it('evicts an answer it cannot read first', () => {
      const storage = new SmallStorage();
      const cache = new LocalAnswerCache(storage, { entries: 2 });
      cache.store(STANDINGS, 'standings', answer(1000));
      storage.setItem(`${ANSWER_PREFIX}${TEAM}`, '{kaputt');

      cache.store(GAME, 'game-info', answer(2000));

      expect(cache.read(TEAM, NOW)).toBeUndefined();
      expect(kept(cache, [STANDINGS, GAME])).toEqual([STANDINGS, GAME]);
    });
  });

  it.each([
    ['of another version', { v: 1, am: 1000, antwort: {} }],
    ['without its time', { v: 2, art: 'tabelle', antwort: {} }],
    ['at no valid time', { v: 2, am: 1e20, art: 'tabelle', antwort: {} }],
  ])('reads a stored answer %s as none', (_case, stored) => {
    const storage = new SmallStorage();
    storage.setItem(`${ANSWER_PREFIX}${TEAM}`, JSON.stringify(stored));

    expect(new LocalAnswerCache(storage).read(TEAM, NOW)).toBeUndefined();
  });

  describe('the stored kinds', () => {
    it('stores each kind under its name before #2967', () => {
      const storage = new SmallStorage();
      new LocalAnswerCache(storage).store(TEAM, 'team-games', answer(1000));

      expect(
        JSON.parse(storage.getItem(`${ANSWER_PREFIX}${TEAM}`) ?? '{}')
      ).toMatchObject({ art: 'team-spiele' });
      expect(storage.getItem(ANSWER_INDEX)).toContain('"art":"team-spiele"');
    });

    it('serves and keeps an answer stored before #2967', () => {
      const storage = new SmallStorage();
      storage.setItem(
        `${ANSWER_PREFIX}${TEAM}`,
        JSON.stringify({ v: 2, am: 1000, art: 'team-spiele', antwort: {} })
      );
      const cache = new LocalAnswerCache(storage);

      cache.cleanUp(NOW, new Set(['team-games']));

      expect(cache.read(TEAM, NOW)).toEqual(answer(1000, {}));
    });
  });

  it('keeps nothing, and fails nothing, without a storage', () => {
    const cache = new LocalAnswerCache(undefined);

    cache.store(TEAM, 'team-games', answer(1000));
    cache.cleanUp(NOW, new Set());

    expect(cache.read(TEAM, NOW)).toBeUndefined();
  });

  it('fails nothing where the storage throws on every access', () => {
    const blocked = (): never => {
      throw new DOMException('blocked', 'SecurityError');
    };
    const storage: AnswerStorage = {
      get length(): number {
        return blocked();
      },
      key: blocked,
      getItem: blocked,
      setItem: blocked,
      removeItem: blocked,
    };
    const cache = new LocalAnswerCache(storage);

    expect(() => {
      cache.store(TEAM, 'team-games', answer(1000));
      cache.cleanUp(NOW, new Set());
    }).not.toThrow();
    expect(cache.read(TEAM, NOW)).toBeUndefined();
  });
});
