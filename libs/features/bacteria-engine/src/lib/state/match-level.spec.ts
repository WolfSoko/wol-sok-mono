import { LEVELS, playableOnline } from './levels';
import { isMatchLevel, MATCH_LEVELS, pickMatchLevel } from './match-level';

describe('pickMatchLevel', () => {
  const online = MATCH_LEVELS.map((level) => level.id);
  const offline = LEVELS.find((level) => !playableOnline(level));

  it('plays the waiting player’s level', () => {
    expect(pickMatchLevel(online[2], online[3], () => 0)).toEqual({
      levelId: online[2],
      pick: 'waiting',
    });
  });

  it('plays the claimer’s level when the waiting player takes any', () => {
    expect(pickMatchLevel(null, online[3], () => 0)).toEqual({
      levelId: online[3],
      pick: 'claimer',
    });
  });

  it('counts an unknown level or one that does not play online as any', () => {
    expect(pickMatchLevel('moon-base', online[1], () => 0)).toEqual({
      levelId: online[1],
      pick: 'claimer',
    });
    expect(offline).toBeDefined();
    expect(pickMatchLevel(offline?.id ?? null, null, () => 0)).toEqual({
      levelId: online[0],
      pick: 'random',
    });
  });

  it('picks a random level that plays online when neither chose one', () => {
    expect(pickMatchLevel(null, null, () => 0).levelId).toBe(online[0]);
    expect(pickMatchLevel(null, null, () => 0.9999).levelId).toBe(
      online[online.length - 1]
    );
    expect(pickMatchLevel(null, null, () => 1)).toEqual({
      levelId: online[online.length - 1],
      pick: 'random',
    });
  });

  it('only offers levels that play online', () => {
    expect(MATCH_LEVELS.length).toBeGreaterThan(0);
    expect(MATCH_LEVELS.every((level) => playableOnline(level))).toBe(true);
    expect(isMatchLevel(online[0])).toBe(true);
    expect(isMatchLevel(offline?.id)).toBe(false);
    expect(isMatchLevel('moon')).toBe(false);
    expect(isMatchLevel(null)).toBe(false);
  });
});
