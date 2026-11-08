import { noEvents, StepEvents } from './bacteria-simulation';
import { GameBalance } from './game-balance';
import { getMap } from './game-maps';
import { compareDynamicWalls, DynamicWall, GameMap } from './maps';
import { NutrientPellets } from './nutrient-pellets';
import { WeaponEffects } from './weapon-effects';

/**
 * What a match holds besides its bacteria, alike on every simulation: the
 * map, the nutrient pellets, the weapons' effects, the gates and sliding
 * walls as they stand, and what happened in the tick. `BacteriaSimulation`
 * and `GridWar` each keep one and answer the `Simulation` getters from it;
 * what a moved wall or a new map does to the bacteria stays theirs.
 */
export class ArenaFixtures {
  public readonly pellets: NutrientPellets;
  /** The weapons' effects - none at all in a plain match. */
  public readonly weaponEffects = new WeaponEffects();
  private currentMap: GameMap = getMap('corridors');
  private walls: DynamicWall[] = [];
  private tickEvents: StepEvents = noEvents();

  /** The pellets draw their places from `random`, as the match does. */
  public constructor(balance: GameBalance, random: () => number) {
    this.pellets = new NutrientPellets(balance, random);
  }

  public get map(): GameMap {
    return this.currentMap;
  }

  /** Takes effect as the simulation lays its walls out again. */
  public setMap(map: GameMap): void {
    this.currentMap = map;
  }

  /** What happened in the tick so far - added to in place. */
  public get events(): StepEvents {
    return this.tickEvents;
  }

  /** Starts a tick, or a match, with nothing happened yet. */
  public resetEvents(): void {
    this.tickEvents = noEvents();
  }

  /** The gates and sliding walls as they stand. */
  public get dynamicWalls(): readonly DynamicWall[] {
    return this.walls;
  }

  /**
   * Lays the moving walls out as of the match time, with no events - as a
   * match starts or the arena is laid out again.
   */
  public startWalls(width: number, height: number, elapsedSec: number): void {
    this.walls =
      this.currentMap.createDynamicWalls?.(width, height, elapsedSec) ?? [];
  }

  /** No moving walls - an arena not sized yet has none. */
  public clearWalls(): void {
    this.walls = [];
  }

  /**
   * Moves the gates and sliding walls on to the match time and counts the
   * gates that closed or warn in the tick's events. True when a wall now
   * stands elsewhere - the simulation then deals with what it covers.
   */
  public advanceWalls(
    width: number,
    height: number,
    elapsedSec: number
  ): boolean {
    if (this.currentMap.createDynamicWalls == null) {
      return false;
    }
    const previous = this.walls;
    this.walls = this.currentMap.createDynamicWalls(width, height, elapsedSec);
    const { changed, closed, warned } = compareDynamicWalls(
      previous,
      this.walls
    );
    this.tickEvents.gatesClosed += closed;
    this.tickEvents.gatesWarned += warned;
    return changed;
  }
}
