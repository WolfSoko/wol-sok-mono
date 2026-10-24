import { TICKS_PER_SEC } from './fixed-tick';
import { distance, Point } from './geometry';
import {
  getLevel,
  isLadderLevel,
  isLevelId,
  levelDifficulty,
  LEVELS,
} from './levels';
import { MatchEngine } from './match-engine';
import { MatchRecord } from './medallions';
import { planMatch } from './match-setup';
import { EMPTY_PROGRESS, mergeProgress, parseProgress } from './progress';
import {
  addMission,
  firstOpenMission,
  isMissionDone,
  MissionId,
  missionById,
  missionOf,
  missionResult,
  MISSIONS,
  missionsDone,
  missionShortfall,
  nextMission,
} from './training';
import { TRAINING_LEVELS } from './training-levels';
import { xpOf } from './xp';

const RECORD: MatchRecord = {
  levelId: 'training-boost',
  difficulty: 'easy',
  won: true,
  durationSec: 20,
  boostsFired: 2,
  lost: 0,
  peakCount: 500,
  lowestSizeRatio: 1,
  captured: 0,
  enemyCrushed: 0,
  peakShare: 0.2,
  pellets: 6,
};

describe('MISSIONS', () => {
  it('plays each mission on a level of its own, apart from the ladder', () => {
    for (const mission of MISSIONS) {
      expect(getLevel(mission.levelId).id).toBe(mission.levelId);
      expect(isLadderLevel(mission.levelId)).toBe(false);
      // No online match, stored setup or replay names one.
      expect(isLevelId(mission.levelId)).toBe(false);
      expect(missionOf(mission.levelId)).toBe(mission);
    }
    expect(TRAINING_LEVELS.map(({ id }) => id)).toEqual(
      MISSIONS.map(({ levelId }) => levelId)
    );
    expect(missionOf(LEVELS[0].id)).toBeNull();
  });

  it('goes through the missions in order', () => {
    expect(MISSIONS.map(({ id }) => id)).toEqual([
      'steer',
      'feed',
      'boost',
      'attack',
      'fight',
    ]);
    expect(nextMission('steer')?.id).toBe('feed');
    expect(nextMission('fight')).toBeNull();
  });
});

describe('levelDifficulty', () => {
  it("plays a mission's own opponent, whatever difficulty is picked", () => {
    expect(levelDifficulty(getLevel('training-fight'), 'hard')).toBe('easy');
    // A dummy is no computer: the picked difficulty stays, unused.
    expect(levelDifficulty(getLevel('training-steer'), 'hard')).toBe('hard');
    expect(levelDifficulty(LEVELS[0], 'hard')).toBe('hard');
  });
});

describe('missionResult', () => {
  const short = { key: 'training.missions.feed.goal' } as const;

  it('goes on to the mission after the one done', () => {
    expect(missionResult('feed', null, true, { feed: '2026-10-24' })).toEqual({
      shortfall: null,
      first: true,
      allDone: false,
      next: 'boost',
    });
  });

  it('goes on to the first still to do after the last one', () => {
    expect(
      missionResult('fight', null, true, { fight: '2026-10-24' }).next
    ).toBe('steer');
  });

  it('goes on nowhere after a match short of the mission', () => {
    expect(missionResult('feed', short, false, {}).next).toBeNull();
  });

  it('is the end of the training once every mission is done', () => {
    const days = Object.fromEntries(
      MISSIONS.map(({ id }) => [id, '2026-10-24'])
    );
    expect(missionResult('fight', null, true, days)).toMatchObject({
      allDone: true,
      next: null,
    });
  });
});

describe('missionShortfall', () => {
  const boost = MISSIONS[2];

  it('is nothing once the match did the mission', () => {
    expect(missionShortfall(boost, RECORD)).toBeNull();
  });

  it('names the goal after a match that was not won', () => {
    expect(missionShortfall(boost, { ...RECORD, won: false })).toEqual({
      key: 'training.missions.boost.goal',
    });
  });

  it('names the boosts a won match did not fire', () => {
    expect(missionShortfall(boost, { ...RECORD, boostsFired: 1 })).toEqual({
      key: 'training.result.boosts',
      params: { count: 2, fired: 1 },
    });
  });
});

describe('training progress', () => {
  it('keeps the day a mission was first done', () => {
    const done = addMission(EMPTY_PROGRESS, 'steer', '2026-10-24');

    expect(isMissionDone(done.training, 'steer')).toBe(true);
    expect(addMission(done, 'steer', '2026-10-25')).toBe(done);
    expect(addMission(done, 'steer', '2026-10-20').training.steer).toBe(
      '2026-10-20'
    );
  });

  it('counts the missions done and picks up at the first one still to do', () => {
    const progress = addMission(
      addMission(EMPTY_PROGRESS, 'steer', '2026-10-24'),
      'boost',
      '2026-10-24'
    );

    expect(missionsDone(progress.training)).toBe(2);
    expect(firstOpenMission(progress.training)).toBe('feed');
    expect(firstOpenMission({})).toBe('steer');
  });

  it('merges as the earlier day and survives the storage', () => {
    const here = addMission(EMPTY_PROGRESS, 'steer', '2026-10-24');
    const there = addMission(
      addMission(EMPTY_PROGRESS, 'steer', '2026-10-22'),
      'feed',
      '2026-10-23'
    );

    expect(mergeProgress(here, there).training).toEqual({
      steer: '2026-10-22',
      feed: '2026-10-23',
    });
    expect(
      parseProgress(JSON.parse(JSON.stringify(mergeProgress(here, there))))
        .training
    ).toEqual({ steer: '2026-10-22', feed: '2026-10-23' });
    expect(
      parseProgress({ training: { steer: 'yesterday', jump: '2026-10-24' } })
        .training
    ).toEqual({});
  });

  it('is worth XP while it is held', () => {
    expect(
      xpOf(addMission(EMPTY_PROGRESS, 'steer', '2026-10-24')) -
        xpOf(EMPTY_PROGRESS)
    ).toBe(25);
  });
});

/**
 * A coarse grid, so a match plays in seconds: the balance scales with the
 * grid, and the missions were also played through on the normal one,
 * 320 x 180.
 */
const WIDTH = 192;
const HEIGHT = 108;

/**
 * Plays a mission as a new player would - plainly, by the mission's tip -
 * and returns how the match ended.
 */
function playMission(
  id: MissionId,
  seed: number,
  playerAt: (engine: MatchEngine, tick: number) => void
) {
  const { levelId } = missionById(id);
  const { spawns, options } = planMatch({
    levelId,
    mode: 'vs-computer',
    // Picked hard: the level's own opponent plays, as in the game.
    difficulty: levelDifficulty(getLevel(levelId), 'hard'),
    colors: ['orange', 'blue'],
    headStart: 0,
    width: WIDTH,
    height: HEIGHT,
    seed,
  });
  const engine = new MatchEngine(spawns, options);
  const limit = 90 * TICKS_PER_SEC;
  try {
    for (let tick = 0; tick < limit && engine.outcome() === null; tick++) {
      playerAt(engine, tick);
      engine.tick(WIDTH, HEIGHT);
    }
    const [you, opponent] = engine.players;
    return {
      outcome: engine.outcome(),
      boosts: you.boostsFired,
      opponent,
      spawn: spawns[1],
    };
  } finally {
    engine.dispose();
  }
}

/** The centre of a player's colony, null once it is gone. */
function centerOf(engine: MatchEngine, playerId: number): Point | null {
  return (
    engine.simulation.summaries().find((colony) => colony.playerId === playerId)
      ?.center ?? null
  );
}

/** Sends the crosshair to the pellet nearest the colony, twice a second. */
function feed(engine: MatchEngine, tick: number): void {
  if (tick % (TICKS_PER_SEC / 2) !== 0) {
    return;
  }
  const from = centerOf(engine, 0) ?? engine.players[0];
  // An eaten pellet stays in the list, empty, until it comes back.
  const pellets = engine.simulation
    .getNutrients()
    .filter(({ amount }) => amount > 0);
  const nearest = pellets.reduce<Point | null>(
    (best, pellet) =>
      best === null || distance(from, pellet) < distance(from, best)
        ? pellet
        : best,
    null
  );
  if (nearest !== null) {
    engine.setDragTarget(0, nearest.x, nearest.y);
  }
}

/** Charges the enemy's colony, boosting whenever the boost is ready. */
function charge(engine: MatchEngine, tick: number): void {
  if (tick % (TICKS_PER_SEC / 2) !== 0) {
    return;
  }
  const target = centerOf(engine, 1);
  if (target !== null) {
    engine.setDragTarget(0, target.x, target.y);
  }
  engine.boost(0);
}

/*
 * Each mission played through by a scripted player who follows its tip -
 * a balance change that makes one unwinnable fails here. The engine is
 * deterministic, so one seed plays the same match every time.
 */
describe('the training missions', () => {
  it('can be steered onto the zone', () => {
    const { outcome } = playMission('steer', 1, (engine, tick) => {
      if (tick === 0) {
        engine.setDragTarget(0, WIDTH / 2, HEIGHT / 2);
      }
    });

    expect(outcome).toMatchObject({ winner: { id: 0 }, reason: 'hold' });
  });

  it('can be fed through', () => {
    const { outcome } = playMission('feed', 1, feed);

    expect(outcome).toMatchObject({ winner: { id: 0 }, reason: 'harvest' });
  });

  it('can be boosted through, boosting twice on the way', () => {
    const { outcome, boosts } = playMission('boost', 2, (engine, tick) => {
      feed(engine, tick);
      engine.boost(0);
    });

    expect(outcome?.winner?.id).toBe(0);
    expect(boosts).toBeGreaterThanOrEqual(2);
  });

  it('can wipe the dummy out, which never moves', () => {
    const { outcome, opponent, spawn } = playMission('attack', 1, charge);

    expect(outcome).toMatchObject({
      winner: { id: 0 },
      reason: 'annihilation',
    });
    expect(opponent).toMatchObject({
      name: 'Dummy',
      x: spawn.x,
      y: spawn.y,
      boostsFired: 0,
    });
  });

  it('can win the first fight against the easy computer', () => {
    const { outcome } = playMission('fight', 1, (engine, tick) =>
      tick < 15 * TICKS_PER_SEC ? feed(engine, tick) : charge(engine, tick)
    );

    expect(outcome?.winner?.id).toBe(0);
  });
});
