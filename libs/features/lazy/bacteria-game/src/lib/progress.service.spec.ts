import { aMatchRecord } from '../testing/match-record';
import { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PROGRESS_STORAGE_KEY, ProgressService } from './progress.service';
import { dailyLevelId } from './state/daily';
import { getLevel } from './state/levels';
import { MatchRecord } from './state/medallions';
import { MISSIONS } from './state/training';
import { GameAccount } from './storage/game-account';
import { DeviceStorage, GameStorage } from './storage/game-storage';
import { FakeGameAccount } from '../testing/fake-game-account';
import { LateGameStorage } from '../testing/late-game-storage';

const LIMITS = getLevel('hourglass').medal;

/** A gold win: in time and clean, but with a boost. */
const GOLD_WIN = aMatchRecord({
  levelId: 'hourglass',
  difficulty: 'hard',
  durationSec: LIMITS.goldSec,
  boostsFired: 1,
});

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
    // Partly: the texts to translate beside the English ones are left out.
    expect(create().recordMatch(GOLD_WIN)).toMatchObject({
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
      // Won without the ladder: the level after it opens - the level itself
      // was played, it is no news.
      unlocked: ['inner-ring'],
      cosmetics: ['Green colonies', 'Yellow colonies', 'Hourglass arena'],
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
      pellets: 0,
      couchMatches: 0,
      matchXp: 150 + 30,
    });
    expect(stored()['totals']).toEqual(progress.totals());
  });

  it('adds up the pellets eaten and earns Glutton at a hundred', () => {
    const progress = create();

    progress.recordMatch({ ...GOLD_WIN, pellets: 60 });
    expect(progress.totals().pellets).toBe(60);
    expect(progress.achievements()['glutton']).toBeUndefined();

    progress.recordMatch({ ...GOLD_WIN, won: false, pellets: 40 });
    expect(progress.totals().pellets).toBe(100);
    expect(progress.achievements()['glutton']).toBeDefined();
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
    expect(progress.xp()).toBe(first.xp.total + second.xp.total);
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

  it('keeps the deepest endless run, and gives its levels no medallion', () => {
    const progress = create();

    const deep = progress.recordMatch(GOLD_WIN, { endlessWins: 4 });
    progress.recordMatch(GOLD_WIN, { endlessWins: 2 });

    expect(deep.award).toBeNull();
    expect(progress.medal('hourglass', 'hard')).toBeNull();
    expect(progress.endlessBest()).toBe(4);
    expect(stored()['endlessBest']).toBe(4);
  });

  it('keeps no medallion for a rolled level - there is no second go', () => {
    const rolled = { ...GOLD_WIN, levelId: 'gen:cave:123:5' };

    expect(create().recordMatch(rolled).award).toBeNull();
    expect(stored()['medals']).toEqual({});
  });

  describe('the training', () => {
    const [steer, , boost] = MISSIONS;
    const mission = (won: boolean, boostsFired = 2): MatchRecord => ({
      ...GOLD_WIN,
      levelId: boost.levelId,
      difficulty: 'easy',
      won,
      boostsFired,
    });

    it('remembers a mission done, with its XP and nothing else', () => {
      const progress = create();

      expect(progress.recordTraining(mission(true), boost)).toMatchObject({
        award: null,
        achievements: [],
        xp: { parts: [{ label: 'Training mission', xp: 25 }], total: 25 },
        training: { mission: 'boost', done: true, first: true },
      });
      expect(progress.training().boost).toBeDefined();
      expect(progress.missionsDone()).toBe(1);
      expect(progress.nextMission()).toBe('steer');
      expect(progress.totals().matches).toBe(0);
      expect(progress.medals()).toEqual({});

      TestBed.resetTestingModule();
      expect(create().training().boost).toBeDefined();
    });

    it('is done once: again it is worth no XP', () => {
      const progress = create();
      progress.recordTraining(
        { ...mission(true), levelId: steer.levelId },
        steer
      );

      expect(
        progress.recordTraining(
          { ...mission(true), levelId: steer.levelId },
          steer
        )
      ).toMatchObject({
        xp: { total: 0 },
        training: { done: true, first: false },
      });
    });

    it('tells a match what it fell short of', () => {
      const progress = create();

      expect(progress.recordTraining(mission(true, 1), boost)).toMatchObject({
        xp: { total: 0 },
        training: {
          done: false,
          shortfall: {
            key: 'training.result.boosts',
            params: { count: 2, fired: 1 },
          },
        },
      });
      expect(progress.recordTraining(mission(false), boost).training).toEqual({
        mission: 'boost',
        done: false,
        first: false,
        shortfall: { key: 'training.missions.boost.goal' },
      });
      expect(progress.missionsDone()).toBe(0);
    });
  });

  describe('the daily level', () => {
    const DAY = '2026-10-20';
    const daily = (won: boolean, day = DAY): MatchRecord => ({
      ...GOLD_WIN,
      levelId: dailyLevelId(day),
      won,
      durationSec: 10,
      lost: 0,
      boostsFired: 0,
    });

    /** A daily match from its start to its end. */
    function play(progress: ProgressService, won: boolean, day = DAY) {
      progress.startDailyAttempt(day);
      return progress.recordMatch(daily(won, day), { dailyDay: day });
    }

    beforeEach(() => {
      jest.useFakeTimers({ now: new Date(`${DAY}T12:00:00Z`) });
    });

    afterEach(() => jest.useRealTimers());

    it("offers today's level with three attempts and no streak yet", () => {
      expect(create().daily()).toEqual({
        day: DAY,
        levelId: dailyLevelId(DAY),
        attemptsLeft: 3,
        streak: 0,
      });
    });

    it('counts three attempts towards its medallion, then is practice', () => {
      const progress = create();

      const first = play(progress, false);
      play(progress, false);
      play(progress, false);
      const fourth = play(progress, true);

      expect(first.daily).toEqual({ attempt: 1, streak: 1 });
      expect(fourth.daily).toEqual({ attempt: 4, streak: 1 });
      expect(fourth.award?.medal).toBeNull();
      expect(fourth.award?.hint).toContain('practice');
      expect(progress.medal(dailyLevelId(DAY), 'hard')).toBeNull();
      expect(progress.daily().attemptsLeft).toBe(0);
    });

    it('counts an attempt as it starts - one given up is used as well', () => {
      const progress = create();

      progress.startDailyAttempt(DAY);

      expect(progress.daily().attemptsLeft).toBe(2);
      expect(stored()['daily']).toEqual({ day: DAY, attempts: 1, streak: 1 });
    });

    it('keeps the medallion of a counted attempt', () => {
      const progress = create();

      play(progress, true);

      expect(progress.medal(dailyLevelId(DAY), 'hard')).not.toBeNull();
    });

    it('grows the streak day by day, across visits', () => {
      play(create(), false);
      jest.setSystemTime(new Date('2026-10-21T08:00:00Z'));
      TestBed.resetTestingModule();

      const tomorrow = create();
      const earnings = play(tomorrow, false, '2026-10-21');

      expect(earnings.daily?.streak).toBe(2);
      expect(tomorrow.daily()).toEqual({
        day: '2026-10-21',
        levelId: dailyLevelId('2026-10-21'),
        attemptsLeft: 2,
        streak: 2,
      });
    });

    it('counts a match that ran past midnight for the day it started', () => {
      const progress = create();
      progress.startDailyAttempt(DAY);
      jest.setSystemTime(new Date('2026-10-21T00:01:00Z'));

      progress.recordMatch(daily(false), { dailyDay: DAY });

      expect(stored()['daily']).toEqual({ day: DAY, attempts: 1, streak: 1 });
    });

    it('turns the menu to the next day at midnight', () => {
      const progress = create();

      jest.setSystemTime(new Date('2026-10-21T00:00:30Z'));
      jest.advanceTimersByTime(60_000);

      expect(progress.daily().day).toBe('2026-10-21');
    });

    it('is no daily match without the day it was played as', () => {
      expect(create().recordMatch(GOLD_WIN).daily).toBeUndefined();
    });
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

    it('holds the daily attempts to the stored ones, however late they come', () => {
      jest.useFakeTimers({ now: new Date('2026-10-20T12:00:00Z') });
      const day = '2026-10-20';
      const progress = createWith({
        [PROGRESS_STORAGE_KEY]: { daily: { day, attempts: 3, streak: 9 } },
      });

      progress.startDailyAttempt(day);
      const earnings = progress.recordMatch(
        {
          ...GOLD_WIN,
          levelId: dailyLevelId(day),
          durationSec: 10,
          boostsFired: 0,
        },
        { dailyDay: day }
      );
      storage.flush();

      // Which attempt it was is not known before the storage answers.
      expect(earnings.daily).toBeUndefined();
      expect(storage.stored(PROGRESS_STORAGE_KEY)).toMatchObject({
        daily: { day, attempts: 4, streak: 9 },
      });
      expect(progress.medal(dailyLevelId(day), 'hard')).toBeNull();
      jest.useRealTimers();
    });

    it('keeps the deeper endless run, the stored one or the new one', () => {
      const progress = createWith({
        [PROGRESS_STORAGE_KEY]: { endlessBest: 9 },
      });

      progress.recordMatch(GOLD_WIN, { endlessWins: 3 });
      storage.flush();

      expect(progress.endlessBest()).toBe(9);
      expect(storage.stored(PROGRESS_STORAGE_KEY)).toMatchObject({
        endlessBest: 9,
      });
    });

    it('keeps the earlier day of a mission, the stored one or the new one', () => {
      const progress = createWith({
        [PROGRESS_STORAGE_KEY]: { training: { feed: '2026-01-02' } },
      });
      const [, feed] = MISSIONS;

      progress.recordTraining(
        { ...GOLD_WIN, levelId: feed.levelId, difficulty: 'easy' },
        feed
      );
      storage.flush();

      expect(progress.training()).toEqual({ feed: '2026-01-02' });
      expect(storage.stored(PROGRESS_STORAGE_KEY)).toMatchObject({
        training: { feed: '2026-01-02' },
      });
    });

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

    it('counts the XP of a match that ends before the storage answers, without guessing the rank', () => {
      const progress = createWith({
        [PROGRESS_STORAGE_KEY]: {
          medals: { hourglass: { hard: 'gold' } },
          totals: { matchXp: 4000 },
          achievements: { 'first-blood': '2026-10-01' },
        },
      });

      const earnings = progress.recordMatch(GOLD_WIN);
      expect(earnings.xpBefore).toBeNull();
      expect(earnings.unlocked).toEqual([]);
      storage.flush();

      // The gold was held and First Blood earned: neither pays twice.
      expect(progress.xp()).toBe(4000 + 150 + 70 + 50 * 3);
      expect(storage.stored(PROGRESS_STORAGE_KEY)).toMatchObject({
        totals: { matchXp: 4150 },
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

  describe('when another player takes over', () => {
    let account: FakeGameAccount;

    function createFor(
      stored: Record<string, unknown> = {},
      providers: Provider[] = []
    ): ProgressService {
      account = new FakeGameAccount('guest');
      account.seed('guest', stored);
      TestBed.configureTestingModule({
        providers: [
          { provide: GameAccount, useValue: account },
          { provide: GameStorage, useValue: account.storage },
          ...providers,
        ],
      });
      return create();
    }

    it("starts over from the next player's progress", () => {
      const progress = createFor();
      progress.recordMatch(GOLD_WIN);
      account.flush();
      account.seed('ada', {
        [PROGRESS_STORAGE_KEY]: { medals: { corridors: { easy: 'silver' } } },
      });

      account.switchTo('ada');

      expect(progress.loaded()).toBe(false);
      expect(progress.medal('hourglass', 'hard')).toBeNull();
      account.flush();
      expect(progress.loaded()).toBe(true);
      expect(progress.medal('corridors', 'easy')).toBe('silver');
      expect(progress.medal('hourglass', 'hard')).toBeNull();
      expect(progress.totals().matches).toBe(0);
    });

    it("keeps each player's matches in their own storage", () => {
      const progress = createFor();
      account.flush();
      account.switchTo('ada');
      account.flush();

      progress.recordMatch(GOLD_WIN);
      account.flush();

      expect(
        account.storageOf('ada').stored(PROGRESS_STORAGE_KEY)
      ).toMatchObject({ totals: { matches: 1 } });
      expect(account.storageOf('guest').stored(PROGRESS_STORAGE_KEY)).toBe(
        null
      );
    });

    it('hands the progress this device kept before the cloud to the first player, once', () => {
      const device = new LateGameStorage({
        [PROGRESS_STORAGE_KEY]: {
          medals: { hourglass: { hard: 'gold' } },
          totals: { matches: 3 },
        },
      });
      const progress = createFor({}, [
        { provide: DeviceStorage, useValue: device },
      ]);

      device.flush();
      account.flush();
      device.flush();

      expect(progress.medal('hourglass', 'hard')).toBe('gold');
      expect(
        account.storageOf('guest').stored(PROGRESS_STORAGE_KEY)
      ).toMatchObject({ totals: { matches: 3 } });
      expect(device.stored(PROGRESS_STORAGE_KEY)).toBeNull();
    });

    it("adds the guest's progress to the account signed in to, once", () => {
      const progress = createFor({
        [PROGRESS_STORAGE_KEY]: { totals: { matches: 5, wins: 2 } },
      });
      progress.recordMatch(GOLD_WIN);
      account.flush();
      account.seed('ada', {
        [PROGRESS_STORAGE_KEY]: {
          medals: { corridors: { easy: 'silver' } },
          totals: { matches: 10, wins: 4 },
        },
      });

      account.switchTo('ada', true);
      account.flush();

      const expected = {
        medals: { corridors: { easy: 'silver' }, hourglass: { hard: 'gold' } },
        totals: { matches: 16, wins: 7 },
      };
      expect(
        account.storageOf('ada').stored(PROGRESS_STORAGE_KEY)
      ).toMatchObject(expected);
      expect(progress.medals()).toEqual(expected.medals);
      expect(progress.totals()).toMatchObject(expected.totals);
    });
  });
});
