import { TICKS_PER_SEC } from './fixed-tick';
import { GameMap } from './maps';
import { MatchEngine } from './match-engine';
import { getLevel } from './levels';
import { MatchPlan, planMatch } from './match-setup';
import { replayOf } from './replay';
import { createPlayer, Player } from './player.model';
import {
  ANNIHILATION,
  judgeOutcome,
  ruleNote,
  timeLeft,
  WinRule,
  zoneHolder,
} from './win-conditions';

describe('win conditions', () => {
  const TIMED: WinRule = { kind: 'timed', limitSec: 180 };
  const REACTOR: MatchPlan = {
    levelId: 'half-life',
    mode: 'vs-computer',
    difficulty: 'normal',
    colors: ['orange', 'blue'],
    headStart: 0,
    width: 320,
    height: 180,
    seed: 7,
  };

  function colonies(left: number, right: number, lost = 10): Player[] {
    return [
      { ...createPlayer({ id: 0 }), bacteriaCount: left, lost },
      { ...createPlayer({ id: 1 }), bacteriaCount: right, lost },
    ];
  }

  describe('annihilation', () => {
    it('goes on while both colonies live, however long', () => {
      expect(judgeOutcome(ANNIHILATION, colonies(5, 900), 3600)).toBeNull();
    });

    it('gives the match to the last colony left', () => {
      const players = colonies(0, 40);

      expect(judgeOutcome(ANNIHILATION, players, 12)).toEqual({
        winner: players[1],
        reason: 'annihilation',
      });
    });

    it('calls it a draw when both colonies are gone at once', () => {
      expect(judgeOutcome(ANNIHILATION, colonies(0, 0), 12)).toEqual({
        winner: null,
        reason: 'annihilation',
      });
    });

    it('does not end a match that has not started', () => {
      expect(judgeOutcome(ANNIHILATION, colonies(0, 0, 0), 0)).toBeNull();
    });
  });

  describe('timed', () => {
    it('goes on until the limit', () => {
      expect(judgeOutcome(TIMED, colonies(30, 40), 179.99)).toBeNull();
    });

    it('gives the match to the bigger colony once time is up', () => {
      const players = colonies(70, 40);

      expect(judgeOutcome(TIMED, players, 180)).toEqual({
        winner: players[0],
        reason: 'time',
      });
    });

    it('calls equal colonies at the limit a draw', () => {
      expect(judgeOutcome(TIMED, colonies(40, 40), 180)).toEqual({
        winner: null,
        reason: 'time',
      });
    });

    it('does not end a match of fewer than two colonies', () => {
      expect(judgeOutcome(TIMED, colonies(30, 40).slice(1), 200)).toBeNull();
    });

    it('still ends early when a colony is wiped out', () => {
      const players = colonies(25, 0);

      expect(judgeOutcome(TIMED, players, 30)).toEqual({
        winner: players[0],
        reason: 'annihilation',
      });
    });
  });

  it('notes a time limit for the level choice', () => {
    expect(ruleNote({ kind: 'timed', limitSec: 150 })).toBe('Timed · 2:30');
    expect(ruleNote(ANNIHILATION)).toBeNull();
  });

  it('counts the time left down on a timed level only', () => {
    expect(timeLeft(TIMED, 30)).toBe(150);
    expect(timeLeft(TIMED, 200)).toBe(0);
    expect(timeLeft(ANNIHILATION, 30)).toBeNull();
  });

  it('ends a match on a timed level when its clock runs out', () => {
    const { spawns, options } = planMatch(REACTOR);
    const engine = new MatchEngine(spawns, {
      ...options,
      win: { kind: 'timed', limitSec: 2 },
    });
    try {
      while (engine.outcome() == null) {
        engine.tick(320, 180);
      }
      expect(engine.tickCount).toBe(2 * TICKS_PER_SEC);
      expect(engine.outcome()?.reason).toBe('time');
    } finally {
      engine.dispose();
    }
  });

  it('plays the reactor level against the clock', () => {
    const { options } = planMatch(REACTOR);

    expect(options.win).toEqual({ kind: 'timed', limitSec: 150 });
  });

  describe('hold', () => {
    const HOLD: WinRule = { kind: 'hold', holdSec: 30 };

    it('gives the match to the colony that held the zone long enough', () => {
      const players = colonies(30, 40);
      players[1] = { ...players[1], holdTicks: 30 * TICKS_PER_SEC };

      expect(judgeOutcome(HOLD, players, 50)).toEqual({
        winner: players[1],
        reason: 'hold',
      });
    });

    it('goes on until then, and still ends on a wipe-out', () => {
      const players = colonies(30, 40);
      players[0] = { ...players[0], holdTicks: 30 * TICKS_PER_SEC - 1 };

      expect(judgeOutcome(HOLD, players, 50)).toBeNull();
      expect(judgeOutcome(HOLD, colonies(0, 40), 50)?.reason).toBe(
        'annihilation'
      );
    });

    it('notes the time to hold for the level choice', () => {
      expect(ruleNote(HOLD)).toBe('Hold the zone · 0:30');
    });
  });

  it('lets the colony with the most bacteria on the zone hold it', () => {
    expect(
      zoneHolder([
        { playerId: 0, onHill: 12 },
        { playerId: 1, onHill: 5 },
      ])
    ).toBe(0);
    expect(
      zoneHolder([
        { playerId: 0, onHill: 5 },
        { playerId: 1, onHill: 5 },
      ])
    ).toBeNull();
    expect(
      zoneHolder([
        { playerId: 0, onHill: 0 },
        { playerId: 1, onHill: 0 },
      ])
    ).toBeNull();
  });

  it('counts the time the zone is held, on the engine, tick by tick', () => {
    const { spawns, options } = planMatch({
      ...REACTOR,
      levelId: 'control-room',
    });
    const engine = new MatchEngine(spawns, options);
    try {
      expect(options.win).toEqual({ kind: 'hold', holdSec: 30 });
      // Nobody is on the zone at the start - nobody holds it.
      engine.tick(320, 180);
      expect(engine.players.map((player) => player.holdTicks)).toEqual([0, 0]);
    } finally {
      engine.dispose();
    }
  });

  it('credits the colony on the zone with the time it holds it', () => {
    // A zone over the whole left half - the left colony starts on it.
    const leftHalf: GameMap = {
      id: 'left-hill',
      name: 'Left hill',
      description: '',
      createWalls: () => [],
      createZones: (width, height) => [
        { kind: 'hill', x: 0, y: 0, width: width / 2, height },
      ],
    };
    const { spawns, options } = planMatch(REACTOR);
    const engine = new MatchEngine(spawns, {
      ...options,
      map: leftHalf,
      win: { kind: 'hold', holdSec: 1 },
    });
    try {
      while (engine.outcome() == null) {
        engine.tick(320, 180);
      }

      expect(engine.tickCount).toBe(TICKS_PER_SEC);
      expect(engine.outcome()).toEqual({
        winner: engine.players[0],
        reason: 'hold',
      });
    } finally {
      engine.dispose();
    }
  });

  describe('survive', () => {
    const SURVIVE: WinRule = { kind: 'survive', limitSec: 90 };

    it('gives the match to the left colony once it lived through the clock', () => {
      const players = colonies(20, 900);

      expect(judgeOutcome(SURVIVE, players, 89)).toBeNull();
      expect(judgeOutcome(SURVIVE, players, 90)).toEqual({
        winner: players[0],
        reason: 'survive',
      });
    });

    it('still ends on a wipe-out, either way', () => {
      expect(judgeOutcome(SURVIVE, colonies(0, 900), 30)?.winner?.id).toBe(1);
      expect(judgeOutcome(SURVIVE, colonies(20, 0), 30)?.reason).toBe(
        'annihilation'
      );
    });

    it('counts down and notes the clock', () => {
      expect(timeLeft(SURVIVE, 30)).toBe(60);
      expect(ruleNote(SURVIVE)).toBe('Survive · 1:30');
    });
  });

  it('spawns the boss bigger and stronger on a boss level', () => {
    const { spawns, options } = planMatch({ ...REACTOR, levelId: 'meltdown' });
    const boss = getLevel('meltdown').boss;
    const engine = new MatchEngine(spawns, options);
    try {
      expect(spawns[1].startScale).toBe(boss?.startScale);
      expect(spawns[1].traits).toEqual(boss?.traits);
      expect(spawns[0].traits).toBeUndefined();
      const [you, theBoss] = engine.players;
      expect(theBoss.bacteriaCount).toBeGreaterThan(1.5 * you.bacteriaCount);
    } finally {
      engine.dispose();
    }
  });

  it('races a ghost on a boss level without the boss, by size at the end', () => {
    const plan = { ...REACTOR, levelId: 'meltdown' };
    const ghost = replayOf(plan, 'cpu', 600, {
      steers: [],
      drags: [],
      boosts: [],
    });

    const { spawns, options } = planMatch(plan, ghost);

    expect(spawns[1].traits).toBeUndefined();
    expect(spawns[1].startScale).toBe(1);
    expect(options.win).toEqual({ kind: 'timed', limitSec: 60 });
  });
});
