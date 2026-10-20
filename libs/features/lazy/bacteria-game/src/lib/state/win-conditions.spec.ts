import { TICKS_PER_SEC } from './fixed-tick';
import { MatchEngine } from './match-engine';
import { MatchPlan, planMatch } from './match-setup';
import { createPlayer, Player } from './player.model';
import {
  ANNIHILATION,
  judgeOutcome,
  ruleNote,
  timeLeft,
  WinRule,
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
});
