import { XP_FULL_COUNT_BEFORE } from '@wolsok/feat-lazy-bac-game/engine';
import { hiddenFor } from './entries';
import { relabels } from './profile-changed';
import { boardProfileOf, entryLabel, isBlockedName } from './names';
import { nextXp, type XpLedger } from './xp-ledger';

const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 10, 3, 12);
const BEFORE_CUT = XP_FULL_COUNT_BEFORE - HOUR;
const AFTER_CUT = XP_FULL_COUNT_BEFORE + HOUR;

describe('nextXp', () => {
  it('counts up to 25,000 at once for progress from before the boards', () => {
    expect(nextXp(null, 40_000, NOW, BEFORE_CUT).counted).toBe(25_000);
    expect(nextXp(null, 9_000, NOW, BEFORE_CUT).counted).toBe(9_000);
  });

  it('starts every later account at the hourly cap', () => {
    expect(nextXp(null, 40_000, NOW, AFTER_CUT).counted).toBe(2_000);
  });

  it('rises by 2,000 plus 3,000 an hour since the last count', () => {
    const first = nextXp(null, 40_000, NOW, AFTER_CUT);
    expect(nextXp(first, 40_000, NOW + 2 * HOUR, AFTER_CUT).counted).toBe(
      2_000 + 8_000
    );
  });

  it('rises by at most 20,000 a UTC day, and a fall gives no room back', () => {
    let ledger: XpLedger = nextXp(null, 1_000, NOW, AFTER_CUT);
    ledger = nextXp(ledger, 100_000, NOW + 10 * HOUR, AFTER_CUT);
    expect(ledger.risenToday).toBe(20_000);
    expect(ledger.counted).toBe(1_000 + 19_000);
    const fallen = nextXp(ledger, 500, NOW + 10 * HOUR + 1, AFTER_CUT);
    expect(fallen.counted).toBe(500);
    expect(nextXp(fallen, 100_000, NOW + 11 * HOUR, AFTER_CUT).counted).toBe(
      500
    );
    // A new UTC day brings new room.
    expect(
      nextXp(fallen, 100_000, NOW + 13 * HOUR, AFTER_CUT).counted
    ).toBeGreaterThan(500);
  });

  it('follows a reset progress down', () => {
    const ledger = nextXp(null, 9_000, NOW, BEFORE_CUT);
    expect(nextXp(ledger, 100, NOW + HOUR, BEFORE_CUT).counted).toBe(100);
  });
});

describe('isBlockedName', () => {
  it('refuses rude names, also spelt with digits or spaces', () => {
    expect(isBlockedName('Fuck you')).toBe(true);
    expect(isBlockedName('W1chs3r')).toBe(true);
    expect(isBlockedName('s.h.i.t')).toBe(true);
  });

  it('refuses names that pose as a label', () => {
    expect(isBlockedName('Anonymous #4821')).toBe(true);
    expect(isBlockedName('Anonym 12')).toBe(true);
    expect(isBlockedName('Player 0042')).toBe(true);
  });

  it('takes ordinary names', () => {
    for (const name of ['Ada', 'Grape Ape', 'Dickens', 'Petri Dish Pro']) {
      expect(isBlockedName(name)).toBe(false);
    }
  });
});

describe('entryLabel', () => {
  const profile = (extra: object) =>
    boardProfileOf({
      name: 'Ada',
      avatar: { kind: 'preset', id: 3 },
      ...extra,
    });

  it('shows the name and preset only with publicName, on counted rows', () => {
    expect(
      entryLabel('e1', profile({ publicName: true }), 'counted')
    ).toMatchObject({
      name: 'Ada',
      avatar: 3,
    });
    expect(entryLabel('e1', profile({}), 'counted').name).toBeNull();
    expect(
      entryLabel('e1', profile({ publicName: true }), 'provisional').name
    ).toBeNull();
  });

  it('never shows a photo or an uploaded image, nor a blocked name', () => {
    const photo = boardProfileOf({
      name: 'Nazi',
      publicName: true,
      avatar: { kind: 'photo', url: 'https://lh3.googleusercontent.com/x' },
    });
    const label = entryLabel('e1', photo, 'counted');
    expect(label.name).toBeNull();
    expect(label.avatar).toBeGreaterThanOrEqual(0);
    expect(label.tag).toBeLessThan(10_000);
  });
});

describe('relabels', () => {
  it('reacts to what a row shows only', () => {
    const before = boardProfileOf({ name: 'Ada', motto: 'a' });
    expect(relabels(before, boardProfileOf({ name: 'Ada', motto: 'b' }))).toBe(
      false
    );
    expect(
      relabels(before, boardProfileOf({ name: 'Ada', publicName: true }))
    ).toBe(true);
    expect(
      relabels(before, boardProfileOf({ name: 'Ada', boardOptOut: true }))
    ).toBe(true);
  });
});

describe('hiddenFor', () => {
  it("adds the owner's hide while the player is barred from the kind", () => {
    const member = { barred: ['daily'] };
    expect(hiddenFor(member, 'daily', undefined)).toEqual({ admin: true });
    expect(hiddenFor(member, 'xp', { optout: true })).toEqual({ optout: true });
    expect(hiddenFor({}, 'daily', { ban: true })).toEqual({ ban: true });
  });
});
