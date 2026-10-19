import { TestBed } from '@angular/core/testing';
import { PROGRESS_STORAGE_KEY, ProgressService } from './progress.service';
import { getLevel } from './state/levels';
import { MatchRecord } from './state/medallions';
import { GameStorage } from './storage/game-storage';
import { LateGameStorage } from '../testing/late-game-storage';

const LIMITS = getLevel('hourglass').medal;

/** A gold win: in time and clean, but with a boost. */
const GOLD_WIN: MatchRecord = {
  levelId: 'hourglass',
  difficulty: 'hard',
  won: true,
  durationSec: LIMITS.goldSec,
  boostsFired: 1,
  lost: 0,
  peakCount: 1000,
  lowestSizeRatio: 1,
  captured: 0,
  enemyCrushed: 0,
  peakShare: 0,
};

describe('ProgressService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  function create(): ProgressService {
    return TestBed.inject(ProgressService);
  }

  function stored(): Record<string, unknown> {
    return JSON.parse(localStorage.getItem(PROGRESS_STORAGE_KEY) ?? '{}');
  }

  it('awards a medallion and remembers it across visits', () => {
    expect(create().recordMatch(GOLD_WIN)).toEqual({
      award: {
        record: GOLD_WIN,
        medal: 'gold',
        previousBest: null,
        hint: 'Platinum needs a gold win without a boost.',
      },
      achievements: ['first-blood', 'blitz', 'clean-sweep'],
      xp: {
        parts: [
          { label: 'Win · Hard', xp: 150 },
          { label: 'Gold medallion, a new best', xp: 70 },
          { label: '3 achievements', xp: 150 },
        ],
        total: 370,
      },
      xpBefore: 0,
      // Won without the ladder: the level itself opens, and the one after it.
      unlocked: ['hourglass', 'inner-ring'],
    });

    TestBed.resetTestingModule();
    expect(create().medal('hourglass', 'hard')).toBe('gold');
    expect(stored()['medals']).toEqual({ hourglass: { hard: 'gold' } });
  });

  it('counts every match and what it captured and crushed', () => {
    const progress = create();

    progress.recordMatch({ ...GOLD_WIN, captured: 300, enemyCrushed: 40 });
    progress.recordMatch({ ...GOLD_WIN, won: false, captured: 50 });

    expect(progress.totals()).toEqual({
      matches: 2,
      wins: 1,
      captured: 350,
      enemyCrushed: 40,
      couchMatches: 0,
      xp: expect.any(Number),
    });
    expect(stored()['totals']).toEqual(progress.totals());
  });

  it('earns an achievement once, on the day it is earned', () => {
    jest.useFakeTimers({ now: new Date('2026-10-19T12:00:00Z') });
    const progress = create();

    expect(progress.recordMatch(GOLD_WIN).achievements).toContain(
      'first-blood'
    );
    jest.setSystemTime(new Date('2026-10-20T12:00:00Z'));
    expect(progress.recordMatch(GOLD_WIN).achievements).not.toContain(
      'first-blood'
    );

    expect(progress.achievements()['first-blood']).toBe('2026-10-19');
    jest.useRealTimers();
  });

  it('counts the matches between two players towards Couch War', () => {
    const progress = create();

    const earned = Array.from(
      { length: 10 },
      () => progress.recordCouchMatch().achievements
    );

    expect(progress.totals().couchMatches).toBe(10);
    expect(earned.slice(0, 9).flat()).toEqual([]);
    expect(earned[9]).toEqual(['couch-war']);
  });

  it('adds the XP every match earns to the totals', () => {
    const progress = create();

    const first = progress.recordMatch(GOLD_WIN);
    const second = progress.recordCouchMatch();

    expect(second.xpBefore).toBe(first.xp.total);
    expect(progress.totals().xp).toBe(first.xp.total + second.xp.total);
  });

  it('keeps the better medallion and names it in the next award', () => {
    const progress = create();
    progress.recordMatch(GOLD_WIN);
    const { award } = progress.recordMatch({
      ...GOLD_WIN,
      durationSec: LIMITS.silverSec + 1,
    });

    expect(award.medal).toBe('bronze');
    expect(award.previousBest).toBe('gold');
    expect(progress.medal('hourglass', 'hard')).toBe('gold');
  });

  it('opens the next level on the ladder with a win', () => {
    const progress = create();
    expect('twin-chambers' in progress.ladderLocks()).toBe(true);

    progress.recordMatch({ ...GOLD_WIN, levelId: 'pillar-field' });

    expect('twin-chambers' in progress.ladderLocks()).toBe(false);
  });

  it('keeps the levels and difficulties apart', () => {
    const progress = create();
    progress.recordMatch(GOLD_WIN);

    expect(progress.medal('hourglass', 'normal')).toBeNull();
    expect(progress.medal('corridors', 'hard')).toBeNull();
  });

  it('takes in the medallions another tab wins', () => {
    const progress = create();
    progress.recordMatch(GOLD_WIN);
    localStorage.setItem(
      PROGRESS_STORAGE_KEY,
      JSON.stringify({ medals: { corridors: { easy: 'silver' } } })
    );
    window.dispatchEvent(
      new StorageEvent('storage', { key: PROGRESS_STORAGE_KEY })
    );

    expect(progress.medal('corridors', 'easy')).toBe('silver');
    expect(progress.medal('hourglass', 'hard')).toBe('gold');
  });

  it('builds on medallions another tab stored before it could hear of them', () => {
    const progress = create();
    localStorage.setItem(
      PROGRESS_STORAGE_KEY,
      JSON.stringify({ medals: { corridors: { easy: 'silver' } } })
    );

    progress.recordMatch(GOLD_WIN);

    expect(stored()['medals']).toEqual({
      corridors: { easy: 'silver' },
      hourglass: { hard: 'gold' },
    });
  });

  it('stores no medallion for a lost match, but counts it', () => {
    create().recordMatch({ ...GOLD_WIN, won: false });

    expect(stored()['medals']).toEqual({});
    expect(stored()['totals']).toMatchObject({ matches: 1, wins: 0 });
  });

  it('starts empty from unreadable storage', () => {
    localStorage.setItem(PROGRESS_STORAGE_KEY, '{not json');
    expect(create().medal('hourglass', 'hard')).toBeNull();
  });

  describe('with storage that answers late', () => {
    let storage: LateGameStorage;

    function createWith(stored: Record<string, unknown> = {}): ProgressService {
      storage = new LateGameStorage(stored);
      TestBed.configureTestingModule({
        providers: [{ provide: GameStorage, useValue: storage }],
      });
      return create();
    }

    it('shows the stored medallions once the storage answers', () => {
      const progress = createWith({
        [PROGRESS_STORAGE_KEY]: { medals: { hourglass: { hard: 'silver' } } },
      });
      expect(progress.medal('hourglass', 'hard')).toBeNull();

      storage.flush();

      expect(progress.medal('hourglass', 'hard')).toBe('silver');
    });

    it('loses no medallion won before the storage answered', () => {
      const progress = createWith({
        [PROGRESS_STORAGE_KEY]: { medals: { corridors: { easy: 'silver' } } },
      });

      expect(progress.recordMatch(GOLD_WIN).award.medal).toBe('gold');
      storage.flush();

      expect(progress.medal('hourglass', 'hard')).toBe('gold');
      expect(progress.medal('corridors', 'easy')).toBe('silver');
      expect(storage.stored(PROGRESS_STORAGE_KEY)).toMatchObject({
        medals: { corridors: { easy: 'silver' }, hourglass: { hard: 'gold' } },
        totals: { matches: 1, wins: 1 },
      });
    });

    it('adds a match to the stored totals, whenever they arrive', () => {
      const progress = createWith({
        [PROGRESS_STORAGE_KEY]: {
          medals: {},
          totals: { matches: 50, wins: 30 },
        },
      });

      progress.recordMatch(GOLD_WIN);
      storage.flush();

      expect(progress.totals()).toMatchObject({ matches: 51, wins: 31 });
      expect(storage.stored(PROGRESS_STORAGE_KEY)).toMatchObject({
        totals: { matches: 51, wins: 31 },
      });
    });

    it('earns what the stored progress earns on its own, as it loads', () => {
      const progress = createWith({
        [PROGRESS_STORAGE_KEY]: { medals: { villi: { easy: 'platinum' } } },
      });

      storage.flush();
      storage.flush();

      expect(Object.keys(progress.achievements())).toEqual([
        'first-blood',
        'flawless',
      ]);
      expect(storage.stored(PROGRESS_STORAGE_KEY)).toMatchObject({
        achievements: { 'first-blood': expect.any(String) },
      });
      expect(progress.recordCouchMatch().achievements).toEqual([]);
    });

    it('keeps the better medallion when another device stores a worse one', () => {
      const progress = createWith();
      progress.recordMatch(GOLD_WIN);
      storage.flush();

      // Another device writes - this service hears of it as any watcher would.
      storage.write(PROGRESS_STORAGE_KEY, {
        medals: { hourglass: { hard: 'bronze' }, villi: { easy: 'gold' } },
      });
      storage.flush();

      expect(progress.medal('hourglass', 'hard')).toBe('gold');
      expect(progress.medal('villi', 'easy')).toBe('gold');
    });
  });
});
