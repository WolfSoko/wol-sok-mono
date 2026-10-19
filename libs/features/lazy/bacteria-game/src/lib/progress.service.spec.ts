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
};

describe('ProgressService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  function create(): ProgressService {
    return TestBed.inject(ProgressService);
  }

  it('awards a medallion and remembers it across visits', () => {
    expect(create().recordMatch(GOLD_WIN)).toEqual({
      record: GOLD_WIN,
      medal: 'gold',
      previousBest: null,
      hint: 'Platinum needs a gold win without a boost.',
    });

    TestBed.resetTestingModule();
    expect(create().medal('hourglass', 'hard')).toBe('gold');
    expect(
      JSON.parse(localStorage.getItem(PROGRESS_STORAGE_KEY) ?? '{}')
    ).toEqual({ medals: { hourglass: { hard: 'gold' } } });
  });

  it('keeps the better medallion and names it in the next award', () => {
    const progress = create();
    progress.recordMatch(GOLD_WIN);
    const award = progress.recordMatch({
      ...GOLD_WIN,
      durationSec: LIMITS.silverSec + 1,
    });

    expect(award.medal).toBe('bronze');
    expect(award.previousBest).toBe('gold');
    expect(progress.medal('hourglass', 'hard')).toBe('gold');
  });

  it('does not touch the storage for a medallion no better than the best', () => {
    const progress = create();
    progress.recordMatch(GOLD_WIN);
    const setItem = jest.spyOn(Storage.prototype, 'setItem');

    progress.recordMatch({ ...GOLD_WIN, durationSec: LIMITS.silverSec + 1 });

    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
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

    expect(
      JSON.parse(localStorage.getItem(PROGRESS_STORAGE_KEY) ?? '{}')
    ).toEqual({
      medals: { corridors: { easy: 'silver' }, hourglass: { hard: 'gold' } },
    });
  });

  it('stores nothing for a match without a medallion', () => {
    create().recordMatch({ ...GOLD_WIN, won: false });

    expect(localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull();
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

      expect(progress.recordMatch(GOLD_WIN).medal).toBe('gold');
      storage.flush();

      expect(progress.medal('hourglass', 'hard')).toBe('gold');
      expect(progress.medal('corridors', 'easy')).toBe('silver');
      expect(storage.stored(PROGRESS_STORAGE_KEY)).toEqual({
        medals: { corridors: { easy: 'silver' }, hourglass: { hard: 'gold' } },
      });
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
