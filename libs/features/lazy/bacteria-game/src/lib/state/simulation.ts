import type { ActiveEffect } from './evolution';
import { ColonySpawn, Nutrient, StepEvents } from './bacteria-simulation';
import { GameBalance } from './game-balance';
import { CellBounds, Point } from './geometry';
import { DynamicWall, GameMap } from './maps';
import { Bacteria, Player, PlayerColorArray } from './player.model';

/**
 * A texture of the GPU simulation (a `WebGLTexture`), typed without the DOM
 * library so the engine type-checks in Node too. Only the WebGL painter and
 * the GPU simulation, which share the context, touch it.
 */
export type GpuTexture = object;

/** What the renderer needs to know about one colony. */
export type ColonyLayer = CellsLayer | StateLayer;

interface ColonyLayerBase {
  /** RGBA, the alpha from 0 to 255. */
  color: readonly number[];
  /**
   * The crosshair of a colony whose boost runs - waves of light rush across
   * the colony towards it. Null without a boost.
   */
  boostTarget: Point | null;
}

/** A colony of the CPU simulation: its bacteria. */
export interface CellsLayer extends ColonyLayerBase {
  kind: 'cells';
  bacterias: readonly Bacteria[];
}

/**
 * A colony of the GPU simulation: where it is in the state texture. Only
 * the WebGL painter, which shares the simulation's context, can draw it.
 */
export interface StateLayer extends ColonyLayerBase {
  kind: 'state';
  /** The simulation's cell state texture. */
  state: GpuTexture;
  /**
   * The glow of fights, meals and pushes - one texture for all colonies,
   * see the simulation's `EFFECTS_FRAGMENT`.
   */
  effects: GpuTexture;
  /** The owner value of the colony's cells in the state. */
  owner: number;
  /** The coarse box around the colony, null once it is gone. */
  bounds: CellBounds | null;
}

/** What the rest of the game needs to know about a colony each frame. */
export interface ColonySummary {
  playerId: number;
  color: PlayerColorArray;
  /** Living bacteria. */
  count: number;
  /** Enemy bacteria eaten since the match started. */
  captured: number;
  /** Own bacteria lost since the match started. */
  lost: number;
  /** Sum of the energy of all bacteria. */
  totalEnergy: number;
  /** Centre of mass, null once the colony is gone. */
  center: Point | null;
  /** Living bacteria on the zone a hold-the-zone level is won on. */
  onHill: number;
  /** Pellets the colony ate up since the match started. */
  pellets: number;
}

/**
 * Where the colonies are, coarsely: the arena cut into blocks of cells, and
 * the bacteria of each colony in each block - for the minimap.
 */
export interface BlockCounts {
  /** Blocks across and down. */
  blocksX: number;
  blocksY: number;
  /** Arena cells per block along each axis. */
  cellSize: number;
  /**
   * Per colony, in the order of the summaries: its bacteria per block, row
   * by row.
   */
  counts: readonly Uint32Array[];
}

/**
 * A ruleset every device plays bit for bit alike (ADR 0015): the float CPU
 * simulation, or the deterministic integer one, on the GPU or the CPU.
 * Replays, online matches and ranked entries name theirs.
 */
export type Ruleset = 'cpu' | 'gpu-int';

/** True for a ruleset this client knows. */
export function isRuleset(value: unknown): value is Ruleset {
  return value === 'cpu' || value === 'gpu-int';
}

/**
 * The colony war, whichever processor runs it. The CPU one is
 * `BacteriaSimulation`; the GPU one runs the same rules as WebGL2 shader
 * passes and reports its numbers a frame late.
 */
export interface Simulation {
  /**
   * Which simulation runs the war: the float one on the CPU or the GPU, or
   * the deterministic integer one on the CPU (`IntSimulation`, ADR 0015).
   * Only a `cpu` match replays on `BacteriaSimulation`.
   */
  readonly kind: 'cpu' | 'gpu' | 'int';
  /**
   * The ruleset its matches play by (ADR 0015): `cpu` for
   * `BacteriaSimulation`, `gpu-int` for the deterministic integer passes on
   * either processor - null for the float GPU one, whose matches no device
   * plays again alike.
   */
  readonly ruleset: Ruleset | null;
  setMap(map: GameMap): void;
  resize(width: number, height: number): void;
  /** Replaces all colonies with a fresh blob per player. */
  init(spawns: ColonySpawn[]): void;
  /** Advances the war by one tick towards the players' crosshairs. */
  step(players: Player[], deltaTimeSec: number): void;
  getNutrients(): Nutrient[];
  getDynamicWalls(): readonly DynamicWall[];
  /** The weapons' effects acting on the war now - see `evolution.ts`. */
  getActiveEffects(): readonly ActiveEffect[];
  /**
   * Lets a weapon's effect act on the war from the next step on, for as
   * long as it lasts - one step for a strike.
   */
  addEffect(effect: ActiveEffect): void;
  /** What happened during the last tick. */
  getEvents(): StepEvents;
  summaries(): readonly ColonySummary[];
  /** Where the colonies are, block by block - null before the GPU reported. */
  blockCounts(): BlockCounts | null;
  /**
   * The colonies as the painter draws them; `boosts` holds the crosshairs
   * of the players whose boost runs, by player id.
   */
  colonyLayers(boosts: ReadonlyMap<number, Point>): ColonyLayer[];
  /** The bacterium of another colony closest to a point, null without one. */
  nearestEnemy(playerId: number, from: Point): Point | null;
  /** Frees whatever the simulation holds outside the JavaScript heap. */
  dispose(): void;
}

/**
 * Builds the simulation of one match, drawing every chance - the pellets
 * included - from `random`. `seed` is the match's own, for a simulation that
 * draws its chances from it directly (the deterministic GPU one, ADR 0015).
 */
export type SimulationFactory = (
  balance: GameBalance,
  random: () => number,
  seed: number
) => Simulation;

/**
 * True when matches run the deterministic simulation of ADR 0015 where the
 * device can: the integer passes on a GPU that passed the self-test, the
 * CPU's ruleset else. The rollout's switch (step 8): off until the owner's
 * real-device check passed - meanwhile `?sim=gpu-int` opts one device in
 * for local play (see `chooseSimulation`).
 */
export const DETERMINISTIC_SIMULATION = false;
