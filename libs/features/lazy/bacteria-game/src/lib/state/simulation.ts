import type { ColonyLayer } from '../arena/colony-renderer';
import { ColonySpawn, Nutrient, StepEvents } from './bacteria-simulation';
import { GameBalance } from './game-balance';
import { Point } from './geometry';
import { DynamicWall, GameMap } from './maps';
import { Player, PlayerColorArray } from './player.model';

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
}

/**
 * The colony war, whichever processor runs it. The CPU one is
 * `BacteriaSimulation`; the GPU one runs the same rules as WebGL2 shader
 * passes and reports its numbers a frame late.
 */
export interface Simulation {
  /** Which processor runs the war. */
  readonly kind: 'cpu' | 'gpu';
  setMap(map: GameMap): void;
  resize(width: number, height: number): void;
  /** Replaces all colonies with a fresh blob per player. */
  init(spawns: ColonySpawn[]): void;
  /** Advances the war by one frame towards the players' crosshairs. */
  step(players: Player[], deltaTimeSec: number): void;
  getNutrients(): Nutrient[];
  getDynamicWalls(): readonly DynamicWall[];
  /** What happened during the last frame. */
  getEvents(): StepEvents;
  summaries(): readonly ColonySummary[];
  /**
   * The colonies as the painter draws them; `boosted` holds the players
   * whose boost runs.
   */
  colonyLayers(boosted: ReadonlySet<number>): ColonyLayer[];
  /** The bacterium of another colony closest to a point, null without one. */
  nearestEnemy(playerId: number, from: Point): Point | null;
  /** Frees whatever the simulation holds outside the JavaScript heap. */
  dispose(): void;
}

/** Builds the simulation of one match. */
export type SimulationFactory = (balance: GameBalance) => Simulation;
