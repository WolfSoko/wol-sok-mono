import { ArenaFixtures } from './arena-fixtures';
import type { ActiveEffect } from './evolution';
import { gameBalance } from './game-balance';
import { DynamicWall, GameMap } from './maps';

/** A gate that warns from 1 s and is shut from 2 s on. */
function gate(timeSec: number): DynamicWall {
  return {
    x: 10,
    y: 0,
    width: 4,
    height: 20,
    solid: timeSec >= 2,
    warning: timeSec >= 1 && timeSec < 2 ? 0.5 : 0,
  };
}

const gateMap: GameMap = {
  id: 'gate',
  name: 'Gate',
  description: 'One gate',
  createWalls: () => [],
  createDynamicWalls: (_width, _height, timeSec) => [gate(timeSec)],
};

const plainMap: GameMap = {
  id: 'plain',
  name: 'Plain',
  description: 'No walls',
  createWalls: () => [],
};

function fixtures(map: GameMap): ArenaFixtures {
  const arena = new ArenaFixtures(gameBalance, () => 0.5);
  arena.setMap(map);
  return arena;
}

describe('ArenaFixtures', () => {
  it('lays the moving walls out as of the match time, with no events', () => {
    const arena = fixtures(gateMap);
    arena.startWalls(40, 20, 2);
    expect(arena.dynamicWalls).toEqual([gate(2)]);
    expect(arena.events.gatesClosed).toBe(0);
  });

  it('counts a gate that starts to warn, then closes, as it moves on', () => {
    const arena = fixtures(gateMap);
    arena.startWalls(40, 20, 0);
    expect(arena.advanceWalls(40, 20, 0.5)).toBe(false);
    expect(arena.advanceWalls(40, 20, 1)).toBe(false);
    expect(arena.events.gatesWarned).toBe(1);
    expect(arena.advanceWalls(40, 20, 2)).toBe(true);
    expect(arena.events.gatesClosed).toBe(1);
    expect(arena.dynamicWalls).toEqual([gate(2)]);
  });

  it('starts every tick with nothing happened', () => {
    const arena = fixtures(gateMap);
    arena.startWalls(40, 20, 0);
    arena.advanceWalls(40, 20, 2);
    arena.resetEvents();
    expect(arena.events.gatesClosed).toBe(0);
  });

  it('has no moving walls on a map without any, or once cleared', () => {
    const plain = fixtures(plainMap);
    plain.startWalls(40, 20, 0);
    expect(plain.advanceWalls(40, 20, 5)).toBe(false);
    expect(plain.dynamicWalls).toEqual([]);

    const gated = fixtures(gateMap);
    gated.startWalls(40, 20, 0);
    gated.clearWalls();
    expect(gated.dynamicWalls).toEqual([]);
  });

  it('lets an added effect act and lists the pellets', () => {
    const arena = fixtures(plainMap);
    const effect: ActiveEffect = {
      weapon: 'toxin-bomb',
      owner: 1,
      x: 5,
      y: 5,
      radius: 3,
      remainingSec: 1,
      durationSec: 1,
    };
    arena.addEffect(effect);
    expect(arena.getActiveEffects()).toEqual([effect]);
    expect(arena.getNutrients()).toBe(arena.pellets.nutrients);
  });
});
