import { BacteriaSimulation } from './bacteria-simulation';
import { BOT_DIFFICULTIES } from './bot-controller';
import { computerLoadout } from './computer-opponent';
import { LADDER_VERSION } from './difficulty-curve';
import { dailyLevelId } from './daily';
import { BALANCE_VERSION } from './game-balance';
import { LEVELS } from './levels';
import { MatchEngine } from './match-engine';
import { MatchPlan, planMatch } from './match-setup';
import { playReplay, replayOf } from './replay';

/**
 * Plain matches - no loadouts - played to a fingerprint of every bacterium
 * and every player. A plain match has to play bit for bit the same under
 * one `BALANCE_VERSION`, or every recorded replay of it plays another
 * match (ADR 0011). A change that moves a fingerprint on purpose raises
 * `BALANCE_VERSION` and takes the new fingerprints over.
 */
const PLAN: MatchPlan = {
  levelId: 'petri-dish',
  mode: 'vs-computer',
  difficulty: 'hard',
  colors: ['orange', 'blue'],
  headStart: 0,
  width: 320,
  height: 140,
  seed: 1234,
};

const GOLDEN: { name: string; plan: MatchPlan; fingerprint: string }[] = [
  { name: 'the first level', plan: PLAN, fingerprint: '104490:cce5179' },
  {
    name: 'a boss',
    plan: { ...PLAN, levelId: 'meltdown', width: 320, height: 180 },
    fingerprint: '74760:e8536005',
  },
  {
    name: 'a boss on normal',
    plan: {
      ...PLAN,
      levelId: 'patient-zero',
      difficulty: 'normal',
      width: 320,
      height: 180,
    },
    fingerprint: '69328:24fdf66b',
  },
  {
    name: 'neutral colonies',
    plan: { ...PLAN, levelId: 'quarantine', width: 320, height: 180 },
    fingerprint: '87450:edbfd521',
  },
  {
    name: 'a zone to hold',
    plan: { ...PLAN, levelId: 'control-room', width: 320, height: 180 },
    fingerprint: '63265:4c379b08',
  },
  {
    name: 'two players',
    plan: { ...PLAN, mode: 'two-players', headStart: 1 },
    fingerprint: '84186:e5d63371',
  },
  {
    name: 'a generated level',
    plan: { ...PLAN, levelId: dailyLevelId('2026-10-20') },
    fingerprint: '69544:bf453038',
  },
];

/** A human who steers, lets go, drags and boosts - in each human seat. */
function play(plan: MatchPlan, ticks: number): MatchEngine {
  const { spawns, options } = planMatch(plan);
  const engine = new MatchEngine(spawns, options);
  for (let tick = 0; tick < ticks && engine.outcome() == null; tick++) {
    engine.setSteering(0, tick < 60 ? { x: 1, y: 0.5 } : { x: 0, y: 0 });
    engine.setSteering(1, tick < 80 ? { x: -1, y: -0.25 } : { x: 0, y: 0 });
    if (tick === 90) {
      engine.setDragTarget(0, plan.width * 0.6, plan.height * 0.25);
      engine.setDragTarget(1, plan.width * 0.3, plan.height * 0.7);
    }
    if (tick === 150 || tick === 400) {
      engine.boost(0);
      if (engine.isLive(1)) {
        engine.boost(1);
      }
    }
    engine.tick(plan.width, plan.height);
  }
  return engine;
}

/** FNV-1a over everything the match holds - players and bacteria. */
function fingerprint(engine: MatchEngine): string {
  const simulation = engine.simulation as BacteriaSimulation;
  return fingerprintOf({
    ticks: engine.tickCount,
    // Without what only the painter dresses a seat by - no part of the play.
    players: engine.players.map(
      ({ computer: _computer, boss: _boss, ...played }) => played
    ),
    colonies: simulation.getColonies().map((colony) => ({
      captured: colony.captured,
      lost: colony.lost,
      pellets: colony.pellets,
      bacterias: colony.cells
        .toBacteria()
        .map(({ x, y, energy }) => [x, y, energy]),
    })),
    nutrients: simulation.getNutrients(),
  });
}

/** FNV-1a over a value's JSON, with its length. */
function fingerprintOf(value: unknown): string {
  const text = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193) >>> 0;
  }
  return `${text.length}:${hash.toString(16)}`;
}

/**
 * A match against the ladder's computer (ADR 0016): its skill along the
 * curve and its loadout. It plays bit for bit the same under one
 * `LADDER_VERSION` and `BALANCE_VERSION`, or every version 4 replay plays
 * another match: a change to the ladder that moves it on purpose raises
 * `LADDER_VERSION`, one to the balance or the rules `BALANCE_VERSION`, and
 * takes the new fingerprint over.
 */
const LADDER_PLAN: MatchPlan = {
  ...PLAN,
  levelId: 'villi',
  width: 320,
  height: 180,
  loadouts: [
    { genes: { mitosis: 2, toxins: 1 }, weapon: 'toxin-bomb' },
    computerLoadout('villi', 'hard'),
  ],
  ladder: LADDER_VERSION,
};
const LADDER_FINGERPRINT = '112750:7220e363';
/**
 * The computer's loadouts on every ladder level and difficulty. A replay
 * against it takes them from the ladder, not from its header, so what moves
 * them - its budget, a character, the gene or weapon costs it spends
 * along - raises `LADDER_VERSION` as well.
 */
const LADDER_LOADOUTS_FINGERPRINT = '4747:9206f2e5';

describe("the ladder's computer", () => {
  it('plays under the ladder version the fingerprint was taken with', () => {
    expect(LADDER_VERSION).toBe(2);
  });

  it('carries the loadouts it had on every ladder level', () => {
    const loadouts = LEVELS.flatMap(({ id: levelId }) =>
      BOT_DIFFICULTIES.map(({ id: difficulty }) =>
        computerLoadout(levelId, difficulty)
      )
    );

    expect(fingerprintOf(loadouts)).toBe(LADDER_LOADOUTS_FINGERPRINT);
  });

  it('plays a match bit for bit as before', () => {
    const engine = play(LADDER_PLAN, 480);
    try {
      expect(fingerprint(engine)).toBe(LADDER_FINGERPRINT);
      const replay = replayOf(
        LADDER_PLAN,
        'cpu',
        engine.tickCount,
        engine.recorded
      );
      expect(playReplay(replay)?.players).toEqual(engine.players);
    } finally {
      engine.dispose();
    }
  });
});

describe('plain matches', () => {
  it('play under the balance version the fingerprints were taken with', () => {
    expect(BALANCE_VERSION).toBe(7);
  });

  it.each(GOLDEN)(
    'play $name bit for bit as before',
    ({ plan, fingerprint: expected }) => {
      const engine = play(plan, 480);
      try {
        expect(fingerprint(engine)).toBe(expected);
        const replay = replayOf(plan, 'cpu', engine.tickCount, engine.recorded);
        expect(playReplay(replay)?.players).toEqual(engine.players);
      } finally {
        engine.dispose();
      }
    }
  );
});
