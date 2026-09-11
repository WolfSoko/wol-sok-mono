import { gameBalance } from './game-balance';
import {
  DEFAULT_CROSSHAIR_SPEED,
  getLevel,
  LEVELS,
  levelBalance,
  levelCrosshairSpeed,
  levelMap,
  nextLevel,
} from './levels';
import { GAME_MAPS } from './maps';

describe('LEVELS', () => {
  it('uses unique ids', () => {
    const ids = LEVELS.map((level) => level.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only references maps that exist', () => {
    const mapIds = GAME_MAPS.map((map) => map.id);

    for (const level of LEVELS) {
      expect(mapIds).toContain(level.mapId);
    }
  });

  it('plays every map at least once', () => {
    const played = new Set(LEVELS.map((level) => level.mapId));

    expect(played.size).toBe(GAME_MAPS.length);
  });
});

describe('levelBalance', () => {
  it('applies the tweaks of a level on top of the base balance', () => {
    const level = getLevel('petri-dish');

    const balance = levelBalance(level);

    expect(balance.aggression).toBe(level.balance?.aggression);
    expect(balance.maxEnergy).toBe(gameBalance.maxEnergy);
  });

  it('hands out the plain balance for a level without tweaks', () => {
    expect(levelBalance(getLevel('corridors'))).toEqual(gameBalance);
  });
});

describe('levelMap', () => {
  it('resolves the map of a level', () => {
    expect(levelMap(getLevel('serpentine')).id).toBe('serpentine');
  });
});

describe('levelCrosshairSpeed', () => {
  it('falls back to the default speed', () => {
    expect(levelCrosshairSpeed(getLevel('corridors'))).toBe(
      DEFAULT_CROSSHAIR_SPEED
    );
  });

  it('uses the speed of the level when it has one', () => {
    expect(levelCrosshairSpeed(getLevel('serpentine'))).toBe(200);
  });
});

describe('getLevel', () => {
  it('falls back to the first level for an unknown id', () => {
    expect(getLevel('nope')).toBe(LEVELS[0]);
  });
});

describe('nextLevel', () => {
  it('walks through the whole list in order', () => {
    let level = LEVELS[0];
    const visited = [level.id];

    for (
      let step = nextLevel(level.id);
      step != null;
      step = nextLevel(level.id)
    ) {
      level = step;
      visited.push(level.id);
    }

    expect(visited).toEqual(LEVELS.map((entry) => entry.id));
  });

  it('has nothing after the last level', () => {
    expect(nextLevel(LEVELS[LEVELS.length - 1].id)).toBeNull();
  });

  it('has nothing after an unknown level', () => {
    expect(nextLevel('nope')).toBeNull();
  });
});
