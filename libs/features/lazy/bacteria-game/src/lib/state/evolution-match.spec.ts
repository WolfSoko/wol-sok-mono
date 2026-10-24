import { scaleOf } from './arena-size';
import {
  evolvedTraits,
  Loadout,
  PLAIN_LOADOUT,
  weaponOf,
  WEAPONS,
} from './evolution';
import { TICKS_PER_SEC } from './fixed-tick';
import { GhostController } from './ghost';
import { getLevel, levelMap } from './levels';
import { MatchEngine, PlayerSpawn } from './match-engine';
import { MatchPlan, planMatch } from './match-setup';
import {
  parseReplay,
  PLAIN_REPLAY_VERSION,
  playReplay,
  Replay,
  replayOf,
  REPLAY_VERSION,
} from './replay';

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

const EVOLVED: Loadout = {
  genes: { mitosis: 3, membrane: 2, flagella: 1 },
  weapon: 'toxin-bomb',
};

/** The match of a plan, set up as the game sets it up. */
function engineOf(plan: MatchPlan, ghost: Replay | null = null): MatchEngine {
  const { spawns, options } = planMatch(plan, ghost);
  return new MatchEngine(spawns, options);
}

/** A human who steers at the enemy and fires the weapon now and then. */
function record(
  plan: MatchPlan,
  ticks: number
): { engine: MatchEngine; replay: Replay } {
  const engine = engineOf(plan);
  for (let tick = 0; tick < ticks && engine.outcome() == null; tick++) {
    engine.setSteering(0, tick < 90 ? { x: 1, y: 0.25 } : { x: 0, y: 0 });
    if (tick === 120) {
      engine.setDragTarget(0, plan.width * 0.6, plan.height * 0.5);
    }
    if (tick % 200 === 100) {
      engine.fireWeapon(0);
    }
    if (tick === 150) {
      engine.boost(0);
    }
    engine.tick(plan.width, plan.height);
  }
  return {
    engine,
    replay: replayOf(plan, 'cpu', engine.tickCount, engine.recorded),
  };
}

describe('planMatch with loadouts', () => {
  it('evolves both seats against the computer', () => {
    const { spawns } = planMatch({
      ...PLAN,
      loadouts: [EVOLVED, { genes: { toxins: 2 }, weapon: 'cryo-pulse' }],
    });

    expect(spawns[0].traits).toEqual(evolvedTraits(EVOLVED));
    expect(spawns[0].weapon).toBe('toxin-bomb');
    expect(spawns[1].traits?.attackFactor).toBeCloseTo(1.1);
    expect(spawns[1].weapon).toBe('cryo-pulse');
  });

  it('evolves a boss on top of its own traits, and arms it', () => {
    const level = getLevel('meltdown');
    const { spawns } = planMatch({
      ...PLAN,
      levelId: 'meltdown',
      loadouts: [EVOLVED, PLAIN_LOADOUT],
    });

    expect(spawns[1].traits).toEqual(
      evolvedTraits(PLAIN_LOADOUT, level.boss?.traits)
    );
    expect(spawns[1].weapon).toBe(level.boss?.weapon);
    expect(spawns[1].weapon).toBeDefined();
  });

  it('leaves a match without loadouts as it was - the boss unarmed', () => {
    const { spawns } = planMatch({ ...PLAN, levelId: 'patient-zero' });

    expect(spawns[0].traits).toBeUndefined();
    expect(spawns[0].weapon).toBeUndefined();
    expect(spawns[1].weapon).toBeUndefined();
    expect(spawns[1].traits).toEqual(getLevel('patient-zero').boss?.traits);
  });

  it.each<[string, Partial<MatchPlan>]>([
    ['between two players', { mode: 'two-players' }],
    ['at one screen with a head start', { mode: 'two-players', headStart: 1 }],
  ])('plays plain %s', (_, changes) => {
    const plain = planMatch({ ...PLAN, ...changes });
    const evolved = planMatch({
      ...PLAN,
      ...changes,
      loadouts: [EVOLVED, EVOLVED],
    });

    expect(evolved.spawns).toEqual(plain.spawns);
  });

  describe('against a ghost', () => {
    const OTHER: Loadout = { genes: { flagella: 4 }, weapon: 'cryo-pulse' };

    it('gives the ghost the loadout its run was played with, and the human theirs', () => {
      const { replay } = record({ ...PLAN, loadouts: [EVOLVED, OTHER] }, 60);
      const plan: MatchPlan = { ...PLAN, loadouts: [OTHER, PLAIN_LOADOUT] };

      const { spawns } = planMatch(plan, replay);

      expect(spawns[0].traits).toEqual(evolvedTraits(OTHER));
      expect(spawns[0].weapon).toBe('cryo-pulse');
      // The run was played from the left seat: its loadout, not the
      // computer's beside it.
      expect(spawns[1].traits).toEqual(evolvedTraits(EVOLVED));
      expect(spawns[1].weapon).toBe('toxin-bomb');
    });

    it('races a plain run plain, beside the human evolved', () => {
      const { replay } = record(PLAN, 60);
      const plan: MatchPlan = { ...PLAN, loadouts: [EVOLVED, OTHER] };

      const { spawns } = planMatch(plan, replay);

      expect(spawns[0].weapon).toBe('toxin-bomb');
      expect(spawns[1].traits).toEqual(evolvedTraits(PLAIN_LOADOUT));
      expect(spawns[1].weapon).toBeNull();
    });

    it('races as before evolution where neither has a loadout', () => {
      const { replay } = record(PLAN, 60);

      const { spawns } = planMatch(PLAN, replay);

      expect(spawns[0].traits).toBeUndefined();
      expect(spawns[1].traits).toBeUndefined();
      expect(spawns[1].weapon).toBeUndefined();
    });

    it('leaves the boss out, armed or not', () => {
      const boss: MatchPlan = { ...PLAN, levelId: 'meltdown' };
      const { replay } = record(
        { ...boss, loadouts: [EVOLVED, PLAIN_LOADOUT] },
        60
      );

      const { spawns } = planMatch(
        { ...boss, loadouts: [PLAIN_LOADOUT, PLAIN_LOADOUT] },
        replay
      );

      expect(spawns[1].boss).toBe(false);
      expect(spawns[1].traits).toEqual(evolvedTraits(EVOLVED));
      expect(spawns[1].weapon).toBe('toxin-bomb');
    });

    it("fires the ghost's weapon where its run fired it", () => {
      const { replay } = record(
        { ...PLAN, loadouts: [EVOLVED, PLAIN_LOADOUT] },
        900
      );
      expect(replay.inputs.weapons.length).toBeGreaterThan(0);

      const race = engineOf(
        { ...PLAN, loadouts: [PLAIN_LOADOUT, PLAIN_LOADOUT] },
        replay
      );
      for (let tick = 0; tick < 900 && race.outcome() == null; tick++) {
        race.tick(PLAN.width, PLAN.height);
      }

      expect(race.players[1].weaponsFired).toBeGreaterThan(0);
      // The ghost's shots are no input of the human at the screen.
      expect(race.recorded.weapons).toEqual([]);
    });
  });

  it('plays plain online', () => {
    const online = { seat: 0 as const, drivers: new Map() };
    const plan: MatchPlan = { ...PLAN, loadouts: [EVOLVED, EVOLVED] };

    expect(planMatch(plan, null, online).spawns).toEqual(
      planMatch(PLAN, null, online).spawns
    );
  });
});

describe('weapons in a match', () => {
  const plan: MatchPlan = { ...PLAN, loadouts: [EVOLVED, PLAIN_LOADOUT] };
  const toxin = weaponOf('toxin-bomb');

  it('does nothing for a colony without a weapon', () => {
    const engine = engineOf(PLAN);

    expect(engine.fireWeapon(0)).toBe(false);
    engine.tick(PLAN.width, PLAN.height);
    expect(engine.recorded.weapons).toEqual([]);
    expect(engine.takeFrameEvents().weapons).toEqual([]);
    expect(engine.simulation.getActiveEffects()).toEqual([]);
  });

  it('fires at the crosshair and records the shot', () => {
    const engine = engineOf(plan);
    engine.tick(PLAN.width, PLAN.height);
    const { x, y } = engine.players[0];

    expect(engine.fireWeapon(0)).toBe(true);
    expect(engine.fireWeapon(0)).toBe(false);
    expect(engine.players[0]).toEqual(
      expect.objectContaining({
        weaponActiveSec: toxin.durationSec,
        weaponCooldownSec: toxin.cooldownSec,
        weaponCooldownFullSec: toxin.cooldownSec,
        weaponsFired: 1,
      })
    );
    expect(engine.recorded.weapons).toEqual([[1, 0]]);

    engine.tick(PLAN.width, PLAN.height);

    const radius =
      toxin.radius * scaleOf(PLAN.width, levelMap(getLevel(PLAN.levelId)).size);
    expect(engine.takeFrameEvents().weapons).toEqual([
      { playerId: 0, weapon: 'toxin-bomb', x, y, radius, isBot: false },
    ]);
    expect(engine.takeFrameEvents().weapons).toEqual([]);
    expect(engine.simulation.getActiveEffects()).toEqual([
      expect.objectContaining({ weapon: 'toxin-bomb', owner: 0, x, y, radius }),
    ]);
  });

  /** A human's colony at (x, y), steered by nobody yet. */
  function spawn(x: number, y: number): PlayerSpawn {
    return { x, y, color: [255, 0, 0, 255], name: 'You', isBot: false };
  }

  it('recharges once the effect has run out, by the weapon cooldown factor', () => {
    const spawns: PlayerSpawn[] = [
      {
        ...spawn(60, 70),
        traits: { ...evolvedTraits(PLAIN_LOADOUT), weaponCooldownFactor: 0.5 },
        weapon: 'toxin-bomb',
      },
      spawn(260, 70),
    ];
    const engine = new MatchEngine(spawns, { seed: 1 });
    const cooldown = toxin.cooldownSec * 0.5;
    engine.fireWeapon(0);
    const tick = (count: number) => {
      for (let i = 0; i < count; i++) {
        engine.tick(320, 140);
      }
    };

    tick(toxin.durationSec * TICKS_PER_SEC);
    expect(engine.players[0].weaponActiveSec).toBe(0);
    expect(engine.players[0].weaponCooldownSec).toBe(cooldown);
    expect(engine.fireWeapon(0)).toBe(false);

    tick(cooldown * TICKS_PER_SEC);
    expect(engine.players[0].weaponCooldownSec).toBe(0);
    expect(engine.fireWeapon(0)).toBe(true);
  });

  it('takes no shot from outside for the computer or a ghost', () => {
    const { replay } = record(plan, 30);
    const engine = engineOf({ ...plan, loadouts: [EVOLVED, EVOLVED] });
    const ghosted = new MatchEngine(planMatch(plan).spawns, {
      ...planMatch(plan).options,
      ghosts: new Map([[0, new GhostController(replay.inputs, 0)]]),
    });

    expect(engine.fireWeapon(1)).toBe(false);
    expect(ghosted.fireWeapon(0)).toBe(false);
  });

  it('acts on the war: a toxin cloud kills the enemy where it falls', () => {
    function enemyLost(fire: boolean): number {
      // An enemy that stays where it is, and the crosshair sent over it.
      const engine = new MatchEngine(
        [
          { ...spawn(60, 70), weapon: 'toxin-bomb' },
          { ...spawn(260, 70), name: 'Other' },
        ],
        { seed: 3 }
      );
      engine.setDragTarget(0, 260, 70);
      for (let tick = 0; tick < 6 * TICKS_PER_SEC; tick++) {
        if (fire && tick === 2 * TICKS_PER_SEC) {
          engine.fireWeapon(0);
        }
        engine.tick(PLAN.width, PLAN.height);
      }
      return engine.players[1].lost;
    }

    expect(enemyLost(true)).toBeGreaterThan(enemyLost(false) + 50);
  });
});

describe('replays with evolution', () => {
  const plan: MatchPlan = {
    ...PLAN,
    loadouts: [EVOLVED, { genes: { toxins: 1 }, weapon: null }],
  };

  it('play a match with loadouts and weapons out the same', () => {
    const { engine, replay } = record(plan, 900);

    expect(replay.header.loadouts).toEqual(plan.loadouts);
    expect(replay.inputs.weapons.length).toBeGreaterThan(0);
    expect(engine.players[0].weaponsFired).toBe(replay.inputs.weapons.length);
    expect(playReplay(replay)?.players).toEqual(engine.players);
  });

  it('read a replay with loadouts back as it was stored', () => {
    const { replay } = record(plan, 300);

    const parsed = parseReplay(JSON.parse(JSON.stringify(replay)));

    expect(parsed).toEqual(replay);
    expect(playReplay(parsed as Replay)?.players).toEqual(
      playReplay(replay)?.players
    );
  });

  it('play a replay from before evolution as it was', () => {
    const { engine, replay } = record(PLAN, 600);
    const old = JSON.parse(JSON.stringify(replay));
    delete old.inputs.weapons;

    const parsed = parseReplay(old);

    expect(parsed?.header.loadouts).toBeUndefined();
    expect(parsed?.inputs.weapons).toEqual([]);
    expect(playReplay(parsed as Replay)?.players).toEqual(engine.players);
  });

  it('refuse a replay whose loadouts are damaged', () => {
    const { replay } = record(plan, 60);
    const damaged = (loadouts: unknown) =>
      parseReplay({ ...replay, header: { ...replay.header, loadouts } });

    expect(damaged([EVOLVED])).toBeNull();
    expect(
      damaged([EVOLVED, { genes: { mitosis: 9 }, weapon: null }])
    ).toBeNull();
    expect(damaged([EVOLVED, { genes: {}, weapon: 'laser' }])).toBeNull();
    expect(
      damaged([EVOLVED, { genes: { gills: 1 }, weapon: null }])
    ).toBeNull();
    expect(damaged([EVOLVED, PLAIN_LOADOUT])).not.toBeNull();
  });

  it('take the new format, which older clients refuse', () => {
    const { replay } = record(plan, 300);

    expect(replay.header.version).toBe(REPLAY_VERSION);
    expect(REPLAY_VERSION).toBeGreaterThan(PLAIN_REPLAY_VERSION);
  });

  it('keep a plain match in the format from before evolution', () => {
    const plainPlan: MatchPlan = {
      ...PLAN,
      loadouts: [PLAIN_LOADOUT, PLAIN_LOADOUT],
    };
    const { engine, replay } = record(plainPlan, 600);
    const before = record(PLAN, 600).replay;

    expect(replay.header.version).toBe(PLAIN_REPLAY_VERSION);
    expect(JSON.stringify(replay.header)).toBe(JSON.stringify(before.header));
    expect(playReplay(replay)?.players).toEqual(engine.players);
  });

  it('take the new format for a boss armed by plain loadouts', () => {
    const { replay } = record(
      {
        ...PLAN,
        levelId: 'meltdown',
        width: 320,
        height: 180,
        loadouts: [PLAIN_LOADOUT, PLAIN_LOADOUT],
      },
      60
    );

    expect(replay.header.version).toBe(REPLAY_VERSION);
    expect(replay.header.loadouts).toEqual([PLAIN_LOADOUT, PLAIN_LOADOUT]);
  });

  it('refuse a replay in the plain format that carries evolution', () => {
    const { replay } = record(plan, 300);
    const plainFormat = { ...replay.header, version: PLAIN_REPLAY_VERSION };

    expect(parseReplay({ ...replay, header: plainFormat })).toBeNull();
    const { loadouts, ...withoutLoadouts } = plainFormat;
    expect(loadouts).toBeDefined();
    expect(parseReplay({ ...replay, header: withoutLoadouts })).toBeNull();
    expect(
      parseReplay({
        header: withoutLoadouts,
        inputs: { ...replay.inputs, weapons: [] },
      })
    ).not.toBeNull();
  });

  it('refuse a format this client does not know', () => {
    const { replay } = record(plan, 60);
    const header = { ...replay.header, version: REPLAY_VERSION + 1 };

    expect(parseReplay({ ...replay, header })).toBeNull();
    expect(playReplay({ ...replay, header })).toBeNull();
  });

  it('refuse weapons fired by a seat nobody plays', () => {
    const { replay } = record(plan, 60);

    expect(
      parseReplay({
        ...replay,
        inputs: { ...replay.inputs, weapons: [[1, 1]] },
      })
    ).toBeNull();
  });
});

describe('a boss with a weapon', () => {
  /** A match against the boss of a level, the human sent at it. */
  function bossMatch(levelId: string, loadouts?: MatchPlan['loadouts']) {
    const plan: MatchPlan = {
      ...PLAN,
      levelId,
      width: 320,
      height: 180,
      loadouts,
    };
    const engine = engineOf(plan);
    const boss = engine.players[1];
    engine.setDragTarget(0, boss.x, boss.y);
    for (let tick = 0; tick < 45 * TICKS_PER_SEC; tick++) {
      if (engine.outcome() != null) {
        break;
      }
      engine.tick(plan.width, plan.height);
    }
    return engine;
  }

  it.each(['meltdown', 'patient-zero'])(
    'fights back on %s with evolution',
    (levelId) => {
      const engine = bossMatch(levelId, [PLAIN_LOADOUT, PLAIN_LOADOUT]);

      expect(engine.players[1].weapon).toBe(getLevel(levelId).boss?.weapon);
      expect(engine.players[1].weaponsFired).toBeGreaterThan(0);
      // The computer's shots are no human input.
      expect(engine.recorded.weapons).toEqual([]);
    }
  );

  it('stays unarmed without evolution', () => {
    const engine = bossMatch('meltdown');

    expect(engine.players[1].weapon).toBeNull();
    expect(engine.players[1].weaponsFired).toBe(0);
  });
});

describe('the weapons', () => {
  it('all last no longer than they take to recharge', () => {
    for (const weapon of WEAPONS) {
      expect(weapon.durationSec).toBeLessThanOrEqual(weapon.cooldownSec);
    }
  });
});
