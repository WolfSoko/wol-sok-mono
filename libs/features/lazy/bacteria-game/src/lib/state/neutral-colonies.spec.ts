import { NEUTRAL_COLOR } from './colony-colors';
import { NEUTRAL_TRAITS } from './game-balance';
import { getLevel } from './levels';
import { MatchEngine } from './match-engine';
import { MatchPlan, planMatch } from './match-setup';

describe('neutral colonies', () => {
  const QUARANTINE: MatchPlan = {
    levelId: 'quarantine',
    mode: 'vs-computer',
    difficulty: 'normal',
    colors: ['orange', 'blue'],
    headStart: 0,
    width: 320,
    height: 180,
    seed: 7,
  };

  it('spawns the level neutral colonies after the players, grey and weak', () => {
    const { spawns } = planMatch(QUARANTINE);

    expect(spawns).toHaveLength(
      2 + (getLevel('quarantine').neutrals ?? []).length
    );
    expect(spawns.slice(0, 2).every((spawn) => spawn.neutral !== true)).toBe(
      true
    );
    for (const spawn of spawns.slice(2)) {
      expect(spawn).toMatchObject({
        neutral: true,
        isBot: false,
        color: NEUTRAL_COLOR,
        traits: NEUTRAL_TRAITS,
      });
    }
  });

  it('gives a neutral colony no player, but counts its bacteria', () => {
    const { spawns, options } = planMatch(QUARANTINE);
    const engine = new MatchEngine(spawns, options);
    try {
      engine.tick(320, 180);

      expect(engine.players).toHaveLength(2);
      expect(engine.neutralCount).toBeGreaterThan(0);
      const colonies = engine.simulation.summaries();
      expect(colonies).toHaveLength(spawns.length);
      const neutral = colonies
        .slice(2)
        .reduce((sum, colony) => sum + colony.count, 0);
      expect(engine.neutralCount).toBe(neutral);
    } finally {
      engine.dispose();
    }
  });

  it('measures a player against the other player, not the neutral colonies', () => {
    const { spawns, options } = planMatch(QUARANTINE);
    // Neutral colonies far bigger than either player.
    const engine = new MatchEngine(
      spawns.map((spawn) =>
        spawn.neutral ? { ...spawn, startScale: 6 } : spawn
      ),
      options
    );
    try {
      engine.tick(320, 180);

      // Even players, near enough after a tick of division - neither is
      // measured against the neutral colonies, six times their size.
      for (const player of engine.players) {
        expect(player.lowestSizeRatio).toBeGreaterThan(0.9);
      }
    } finally {
      engine.dispose();
    }
  });

  it('ends the match on the players alone - the neutral colonies survive it', () => {
    const { spawns, options } = planMatch(QUARANTINE);
    const engine = new MatchEngine(spawns, {
      ...options,
      win: { kind: 'timed', limitSec: 1 },
    });
    try {
      while (engine.outcome() == null) {
        engine.tick(320, 180);
      }

      const winner = engine.outcome()?.winner;
      expect(winner == null || winner.id < 2).toBe(true);
    } finally {
      engine.dispose();
    }
  });

  it('lets a neutral colony wander about the map, slowly', () => {
    const { spawns, options } = planMatch(QUARANTINE);
    const engine = new MatchEngine(spawns, options);
    try {
      const start = engine.simulation.summaries()[2].center;
      for (let tick = 0; tick < 4 * 60; tick++) {
        engine.tick(320, 180);
      }
      const later = engine.simulation.summaries()[2].center;

      expect(start).not.toBeNull();
      expect(later).not.toBeNull();
      const moved = Math.hypot(later!.x - start!.x, later!.y - start!.y);
      expect(moved).toBeGreaterThan(3);
      // Never faster than its hurried pace.
      expect(moved).toBeLessThan(4 * 30);
    } finally {
      engine.dispose();
    }
  });

  it("plays a neutral colony's moves out the same again from the seed", () => {
    const centers = () => {
      const { spawns, options } = planMatch(QUARANTINE);
      const engine = new MatchEngine(spawns, options);
      try {
        for (let tick = 0; tick < 120; tick++) {
          engine.tick(320, 180);
        }
        return engine.simulation.summaries().map(({ center }) => center);
      } finally {
        engine.dispose();
      }
    };

    expect(centers()).toEqual(centers());
  });

  it('refuses a neutral colony before a player', () => {
    const { spawns, options } = planMatch(QUARANTINE);

    expect(
      () => new MatchEngine([spawns[2], spawns[0], spawns[1]], options)
    ).toThrow();
  });
});
