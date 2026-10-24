import { ColonySpawn } from '../bacteria-simulation';
import { ActiveEffect, WeaponId } from '../evolution';
import { TICK_SEC } from '../fixed-tick';
import { GameBalance, gameBalance } from '../game-balance';
import { ENERGY_SCALE } from '../grid-format';
import { DynamicWall, GameMap, Rect } from '../maps';
import { createPlayer, Player, PlayerColorArray } from '../player.model';
import { Simulation } from '../simulation';
import { Zone, ZoneKind } from '../zones';
import { intStateHash } from './int-reference';

/**
 * Whole matches in miniature for the deterministic simulation (ADR 0015,
 * step 7): a map with walls, every kind of zone, a sliding wall and a gate,
 * colonies chasing crosshairs, weapons fired and pellets eaten. Played
 * through the public `Simulation` interface, they check a simulation as the
 * game drives it - `GpuSimulation`'s own uniforms and pass order, not only
 * the shaders - against `IntSimulation`, its TypeScript twin:
 *
 * - the on-device self-test plays {@link SELF_TEST_SCENARIO} on the GPU it
 *   is about to trust;
 * - the CI cross-check plays all of {@link SIM_SCENARIOS} on SwiftShader;
 * - the Jest specs keep `IntSimulation`'s hashes at the goldens.
 *
 * The scenarios use no `Math.sin` and the like, whose last bit may differ
 * between engines, and draw the pellets from a fixed stream of numbers.
 */
export interface SimScenario {
  name: string;
  width: number;
  height: number;
  ticks: number;
  balance: GameBalance;
  matchSeed: number;
  map: GameMap;
  spawns: ColonySpawn[];
  /** The players' crosshairs at a tick - null for a seat without one. */
  crosshairs(tick: number): readonly ({ x: number; y: number } | null)[];
  /** The weapons fired at a tick, before it runs. */
  effects(tick: number): readonly ActiveEffect[];
}

/** A simulation the scenarios can look into - see `GpuSimulation.readState`. */
export interface InspectableSimulation extends Simulation {
  readState(): Uint16Array | null;
}

const COLORS: readonly PlayerColorArray[] = [
  [230, 80, 60, 255],
  [60, 140, 230, 255],
  [90, 200, 90, 255],
  [220, 190, 60, 255],
];

/** A deterministic stream of fractions 0..1, an LCG in 32 bit ints. */
export function fractions(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return s / 4294967296;
  };
}

function zone(
  kind: ZoneKind,
  x: number,
  y: number,
  w: number,
  h: number
): Zone {
  return { kind, x, y, width: w, height: h };
}

/**
 * A walled arena with all five zones, a bar that slides one cell every
 * twentieth of a second and a gate that shuts after half a second.
 */
function testMap(): GameMap {
  const middle = (w: number) => Math.floor(w / 2);
  return {
    id: 'deterministic-test',
    name: 'deterministic-test',
    description: '',
    createWalls: (w, h): Rect[] => [
      { x: 0, y: 0, width: w, height: 1 },
      { x: 0, y: h - 1, width: w, height: 1 },
      { x: 0, y: 0, width: 1, height: h },
      { x: w - 1, y: 0, width: 1, height: h },
      { x: middle(w), y: 1, width: 1, height: Math.floor(h / 4) },
    ],
    createZones: (w, h): Zone[] => [
      zone('ice', 1, 1, Math.floor(w / 4), Math.floor(h / 3)),
      zone(
        'heat',
        w - Math.floor(w / 4) - 1,
        h - Math.floor(h / 3) - 1,
        Math.floor(w / 4),
        Math.floor(h / 3)
      ),
      zone(
        'agar',
        Math.floor(w / 3),
        Math.floor(h / 3),
        Math.floor(w / 6),
        Math.floor(h / 4)
      ),
      zone(
        'antibiotic',
        Math.floor(w / 2) + 2,
        1,
        Math.floor(w / 8),
        Math.floor(h / 5)
      ),
      zone(
        'hill',
        1,
        h - Math.floor(h / 3) - 1,
        Math.floor(w / 5),
        Math.floor(h / 3)
      ),
    ],
    createDynamicWalls: (w, h, timeSec): DynamicWall[] => {
      const slide = Math.floor(timeSec * 20);
      return [
        {
          x: 4 + (slide % Math.floor(w / 3)),
          y: Math.floor(h / 2) - 4,
          width: 2,
          height: 8,
          solid: true,
          warning: 0,
        },
        {
          x: middle(w),
          y: Math.floor(h / 4) + 1,
          width: 1,
          height: Math.floor(h / 4),
          solid: timeSec >= 0.5,
          warning: 0,
        },
      ];
    },
  };
}

function effect(
  weapon: WeaponId,
  owner: number,
  x: number,
  y: number,
  radius: number,
  durationSec: number
): ActiveEffect {
  return {
    weapon,
    owner,
    x,
    y,
    radius,
    remainingSec: durationSec,
    durationSec,
  };
}

/** Four colonies across the test map, each weapon fired along the way. */
function skirmish(
  name: string,
  width: number,
  height: number,
  ticks: number,
  matchSeed: number,
  balance: GameBalance = gameBalance
): SimScenario {
  const w = width;
  const h = height;
  const radius = Math.max(3, Math.floor(Math.min(w, h) / 8));
  const spawns: ColonySpawn[] = [
    { x: w * 0.25, y: h * 0.3, radius },
    { x: w * 0.75, y: h * 0.3, radius },
    { x: w * 0.25, y: h * 0.7, radius },
    { x: w * 0.75, y: h * 0.7, radius },
  ].map((spot, slot) => ({
    playerId: slot + 1,
    color: COLORS[slot],
    ...spot,
  }));
  const tick = (t: number) => Math.floor(ticks * t);
  return {
    name,
    width,
    height,
    ticks,
    balance,
    matchSeed,
    map: testMap(),
    spawns,
    // Each colony chases the one across; the fourth only now and then.
    crosshairs: (t) => [
      { x: w * 0.75, y: h * 0.7 },
      { x: t % 16 < 8 ? w * 0.25 : w * 0.5, y: h * 0.7 },
      { x: w * 0.75, y: h * 0.3 },
      t % 12 < 6 ? { x: w * 0.25, y: h * 0.3 } : null,
    ],
    effects: (t) => {
      const fired: ActiveEffect[] = [];
      if (t === tick(0.1)) {
        fired.push(
          effect('toxin-bomb', 1, w * 0.5, h * 0.35, radius * 1.5, 0.2)
        );
      }
      if (t === tick(0.2)) {
        fired.push(
          effect('cryo-pulse', 3, w * 0.6, h * 0.6, radius * 1.5, 0.3)
        );
      }
      if (t === tick(0.3)) {
        fired.push(effect('agar-bloom', 2, w * 0.75, h * 0.3, radius, 0.4));
      }
      if (t === tick(0.45)) {
        fired.push(effect('phage-strike', 4, w * 0.3, h * 0.3, radius, 0));
      }
      if (t === tick(0.6)) {
        fired.push(effect('biofilm-shield', 3, w * 0.25, h * 0.7, radius, 0.3));
      }
      return fired;
    },
  };
}

/**
 * The scenario the game plays on a device's GPU before it trusts it with a
 * deterministic match: small, so it takes a few milliseconds of GPU time,
 * and long enough for the first reports to come back into the divide
 * budget and the pellets.
 */
export const SELF_TEST_SCENARIO: SimScenario = skirmish(
  'self-test',
  48,
  32,
  16,
  0x5e1f7e57
);

/**
 * What CI plays on SwiftShader: the self-test, a longer match, and one with
 * so little room that the divide budget caps every colony.
 */
export const SIM_SCENARIOS: readonly SimScenario[] = [
  SELF_TEST_SCENARIO,
  skirmish('skirmish', 96, 64, 60, 0xb1f1e5),
  skirmish('crowded', 64, 40, 40, 0xc20d, {
    ...gameBalance,
    maxBacteriaPerPlayer: 120,
    maxTotalBacteria: 400,
  }),
];

/** The pellets' random numbers of a scenario - the same for every run. */
export function scenarioRandom(scenario: SimScenario): () => number {
  return fractions(scenario.matchSeed ^ 0x9e3779b9);
}

/**
 * Plays a scenario on a simulation built for it - sized, with its map, but
 * not yet started - and returns a hash per tick: the state after the tick
 * and the scoreboard the simulation reports, so both the cell passes and
 * what the CPU makes of the reports have to agree.
 */
export function playScenario(
  scenario: SimScenario,
  simulation: InspectableSimulation
): number[] {
  simulation.setMap(scenario.map);
  simulation.resize(scenario.width, scenario.height);
  simulation.init(scenario.spawns);
  const players: Player[] = scenario.spawns.map((spawn) =>
    createPlayer({ id: spawn.playerId, color: spawn.color, x: NaN, y: NaN })
  );
  const hashes: number[] = [];
  for (let tick = 1; tick <= scenario.ticks; tick++) {
    scenario.crosshairs(tick).forEach((aim, seat) => {
      players[seat].x = aim?.x ?? NaN;
      players[seat].y = aim?.y ?? NaN;
    });
    for (const fired of scenario.effects(tick)) {
      simulation.addEffect({ ...fired });
    }
    simulation.step(players, TICK_SEC);
    const state = simulation.readState();
    if (state == null) {
      throw new Error('The simulation has no state to read');
    }
    hashes.push(tickHash(state, simulation));
  }
  return hashes;
}

/** The state's hash folded with the scoreboard's integers. */
function tickHash(state: Uint16Array, simulation: Simulation): number {
  const numbers = [intStateHash(state)];
  for (const colony of simulation.summaries()) {
    numbers.push(
      colony.count,
      colony.captured,
      colony.lost,
      colony.onHill,
      colony.pellets,
      Math.round(colony.totalEnergy * ENERGY_SCALE)
    );
  }
  for (const pellet of simulation.getNutrients()) {
    numbers.push(Math.round(pellet.amount * ENERGY_SCALE));
  }
  let hash = 0x811c9dc5;
  for (const number of numbers) {
    // FNV-1a over the 32 bit values, byte by byte.
    for (let shift = 0; shift < 32; shift += 8) {
      hash = Math.imul(hash ^ ((number >>> shift) & 0xff), 0x01000193) >>> 0;
    }
  }
  return hash;
}

/** Where two runs of a scenario part: ok, or the first tick that differs. */
export interface SelfTestVerdict {
  ok: boolean;
  /** The first tick, from 1, whose hashes differ - absent when they agree. */
  firstBadTick?: number;
}

/** Compares a run's hashes with the reference's. */
export function selfTestVerdict(
  run: readonly number[],
  reference: readonly number[]
): SelfTestVerdict {
  const ticks = Math.max(run.length, reference.length);
  for (let i = 0; i < ticks; i++) {
    if (run[i] !== reference[i]) {
      return { ok: false, firstBadTick: i + 1 };
    }
  }
  return { ok: true };
}
