import { scaleOf } from './arena-size';
import { Nutrient } from './bacteria-simulation';
import {
  BotRoutes,
  BotView,
  BotWeaponView,
  ColonyView,
} from './bot-controller';
import {
  FloodCache,
  lineOf,
  NavField,
  NavGrid,
  navGrid,
  travel,
  waypoint,
  withWalls,
} from './bot-navigation';
import { weaponOf } from './evolution';
import { distance, Point } from './geometry';
import { GameMap, rectCenter } from './maps';
import { isBoostReady, isWeaponReady, Player } from './player.model';
import { ColonySummary, MatchColonies, Simulation } from './simulation';
import { WinRule } from './win-conditions';
import { mapZones } from './zones';

/**
 * What the senses read of the war - and nothing that steps or changes it,
 * so looking at the arena never alters a match.
 */
export type SensedSimulation = Pick<
  Simulation,
  | 'getNutrients'
  | 'getDynamicWalls'
  | 'summaries'
  | 'blockCounts'
  | 'nearestEnemy'
>;

/** What a match's senses are built from. */
export interface BotSensesSetup {
  map: GameMap;
  win: WinRule;
  /** The normal maximum energy of a bacterium, the bots' energy scale. */
  maxEnergy: number;
  /** The most bacteria a colony of the match may grow to. */
  capacity: number;
  /** True when the match has neutral colonies. */
  hasNeutral: boolean;
  simulation: SensedSimulation;
}

/**
 * What the computer opponents see of a match: the colonies, the pellets,
 * the zone to hold, the weapon they carry, and the ways round the walls -
 * static, moving and the zones - which the neutral colonies take as well.
 *
 * It keeps what is dear to work out - the walking grid, its floods and the
 * hold zone - across the ticks, and works the rest out only when asked: a
 * bot decides a few times a second, not every tick.
 */
export class BotSenses {
  /** The grid of the static walls and the zones, by arena size. */
  private nav: {
    width: number;
    height: number;
    grid: NavGrid;
    /**
     * That grid with the moving walls that block now, by where they stand -
     * the same grid as long as they stand still, so its floods are kept.
     */
    walls: { key: string; grid: NavGrid } | null;
  } | null = null;
  private readonly floods = new FloodCache();
  /** The centre of the hold zone on the arena last asked for, by its size. */
  private hill: { width: number; height: number; at: Point | null } | null =
    null;

  public constructor(private readonly setup: BotSensesSetup) {}

  /**
   * What the bot of `player` sees as it decides: its own colony `own`, the
   * strongest enemy colony and the enemy bacterium closest to its own
   * centre of mass - from the colony summaries, so it works the same
   * whichever processor runs the war.
   */
  public viewFor(
    player: Player,
    own: ColonySummary,
    colonies: MatchColonies,
    width: number,
    height: number
  ): BotView {
    const { maxEnergy, simulation, win } = this.setup;
    // The nutrients before the nearest enemy, the routes and the weapon
    // count only when the bot uses them: a simulation sees the same calls
    // in every match, so a replay plays the same.
    const nutrients = simulation.getNutrients();
    const ownView = colonyView(own, maxEnergy);
    const enemy = strongestEnemy(own, colonies.players, maxEnergy);
    // The simulation's nearest enemy may be a neutral bacterium: with
    // neutral colonies about, the bots charge the enemy's centre.
    const nearestEnemy =
      enemy == null || this.setup.hasNeutral
        ? null
        : simulation.nearestEnemy(player.id, ownView);
    return {
      width,
      height,
      own: ownView,
      enemy,
      nearestEnemy,
      nutrients,
      boostReady: isBoostReady(player),
      objective: this.hillAt(width, height),
      routes: this.routesFrom(ownView, width, height),
      // A neutral colony is no enemy to the bots: it is prey, food that bites.
      prey: colonies.neutral.flatMap(neutralFood),
      feeding: win.kind === 'harvest',
      unit: this.unitAt(width),
      weapon: this.weaponView(player, width),
      capacity: this.setup.capacity,
    };
  }

  /**
   * The ways round the walls from a point. The grid and the flood are only
   * worked out once they are asked for.
   */
  public routesFrom(from: Point, width: number, height: number): BotRoutes {
    let grid: NavGrid | null = null;
    let field: NavField | null = null;
    const grid$ = () => (grid ??= this.navGridAt(width, height));
    const field$ = () => (field ??= this.floods.flood(grid$(), from));
    // A clear straight line needs no flood - most decisions on open ground.
    const clear = (to: Point) => lineOf(grid$(), from, to) === 'clear';
    return {
      waypoint: (to) => (clear(to) ? to : waypoint(field$(), to)),
      travel: (to) => (clear(to) ? distance(from, to) : travel(field$(), to)),
    };
  }

  /**
   * What a bot sees of the weapon it carries, null without one: the
   * bacteria round its crosshair are counted only when it asks, from the
   * blocks the simulation counts.
   */
  private weaponView(player: Player, width: number): BotWeaponView | null {
    if (player.weapon == null) {
      return null;
    }
    const radius = weaponOf(player.weapon).radius * this.unitAt(width);
    const crosshair = { x: player.x, y: player.y };
    return {
      id: player.weapon,
      ready: isWeaponReady(player),
      radius,
      at: crosshair,
      around: () => this.bacteriaAround(player.id, crosshair, radius),
    };
  }

  /**
   * A colony's own bacteria and everybody else's - neutral ones too, which
   * the weapons hit as well - in the blocks whose centre lies in a circle.
   */
  private bacteriaAround(
    playerId: number,
    at: Point,
    radius: number
  ): { own: number; enemy: number } {
    const { simulation } = this.setup;
    const blocks = simulation.blockCounts();
    const around = { own: 0, enemy: 0 };
    if (blocks === null) {
      return around;
    }
    const { blocksX, blocksY, cellSize, counts } = blocks;
    const own = simulation
      .summaries()
      .findIndex((summary) => summary.playerId === playerId);
    const reach = Math.ceil(radius / cellSize);
    const centerX = Math.floor(at.x / cellSize);
    const centerY = Math.floor(at.y / cellSize);
    for (
      let by = Math.max(0, centerY - reach);
      by <= Math.min(blocksY - 1, centerY + reach);
      by++
    ) {
      for (
        let bx = Math.max(0, centerX - reach);
        bx <= Math.min(blocksX - 1, centerX + reach);
        bx++
      ) {
        const dx = (bx + 0.5) * cellSize - at.x;
        const dy = (by + 0.5) * cellSize - at.y;
        if (dx * dx + dy * dy > radius * radius) {
          continue;
        }
        const block = by * blocksX + bx;
        for (let index = 0; index < counts.length; index++) {
          if (index === own) {
            around.own += counts[index][block];
          } else {
            around.enemy += counts[index][block];
          }
        }
      }
    }
    return around;
  }

  /**
   * The grid the bots plan on: the static walls and the zones, and the
   * gates and sliding walls that are shut - or about to shut - right now.
   */
  private navGridAt(width: number, height: number): NavGrid {
    const { map, simulation } = this.setup;
    if (this.nav?.width !== width || this.nav.height !== height) {
      this.nav = {
        width,
        height,
        grid: navGrid(
          width,
          height,
          map.createWalls(width, height),
          mapZones(map, width, height),
          this.unitAt(width)
        ),
        walls: null,
      };
    }
    const walls = simulation
      .getDynamicWalls()
      .filter((wall) => wall.solid || wall.warning > 0);
    const key = walls
      .map(
        ({ x, y, width, height, round }) =>
          `${x},${y},${width},${height},${round === true}`
      )
      .join(';');
    if (this.nav.walls?.key !== key) {
      this.nav.walls = { key, grid: withWalls(this.nav.grid, walls) };
    }
    return this.nav.walls.grid;
  }

  /**
   * The centre of the zone a hold-the-zone level is won on, on an arena of
   * that size - null on any other level.
   */
  private hillAt(width: number, height: number): Point | null {
    if (this.setup.win.kind !== 'hold') {
      return null;
    }
    if (this.hill?.width !== width || this.hill.height !== height) {
      const zone = mapZones(this.setup.map, width, height).find(
        ({ kind }) => kind === 'hill'
      );
      this.hill = {
        width,
        height,
        at: zone === undefined ? null : rectCenter(zone),
      };
    }
    return this.hill.at;
  }

  /** Arena cells per base cell on an arena that wide - the grid's resolution. */
  private unitAt(width: number): number {
    return scaleOf(width, this.setup.map.size);
  }
}

/** The biggest colony but `own` that still lives, null once none is left. */
function strongestEnemy(
  own: ColonySummary,
  colonies: readonly ColonySummary[],
  maxEnergy: number
): ColonyView | null {
  let enemy: ColonyView | null = null;
  for (const colony of colonies) {
    if (colony.playerId === own.playerId || colony.count === 0) {
      continue;
    }
    const view = colonyView(colony, maxEnergy);
    if (enemy == null || view.count > enemy.count) {
      enemy = view;
    }
  }
  return enemy;
}

/**
 * A neutral colony as a bot sees it - prey as big as the colony, at its
 * centre - none once it is eaten up.
 */
function neutralFood(colony: ColonySummary): Nutrient[] {
  const { x, y, count } = colonyView(colony, 1);
  return count === 0 ? [] : [{ x, y, amount: count }];
}

/** Centre of mass, size and average energy of a colony. */
function colonyView(colony: ColonySummary, maxEnergy: number): ColonyView {
  if (colony.count === 0 || colony.center == null) {
    return { x: 0, y: 0, count: 0, energy: 0 };
  }
  return {
    x: colony.center.x,
    y: colony.center.y,
    count: colony.count,
    energy: colony.totalEnergy / colony.count / maxEnergy,
  };
}
