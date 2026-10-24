import {
  ActiveEffect,
  EvolvedTraits,
  WEAPON_EFFECTS,
  WeaponId,
} from './evolution';
import {
  actsOn,
  anyCovers,
  covers,
  toughnessOf,
  WeaponEffects,
} from './weapon-effects';
import {
  heatedAggression,
  mapZones,
  stampZones,
  ZONE_CODE,
  ZONE_EFFECTS,
} from './zones';
import {
  colonyCapacity,
  ColonyTraits,
  GameBalance,
  gameBalance,
  PLAIN_TRAITS,
} from './game-balance';
import { clamp, Point } from './geometry';
import { NutrientPellets } from './nutrient-pellets';
import {
  BlockCounts,
  ColonyLayer,
  ColonySummary,
  Simulation,
} from './simulation';
import { compareDynamicWalls, DynamicWall, GameMap, stampRect } from './maps';
import { escapeReach } from './arena-size';
import { getMap } from './game-maps';
import {
  Bacteria,
  createBacteriaBlob,
  isBoosted,
  Player,
  PlayerColorArray,
} from './player.model';

export const EMPTY_CELL = -1;
export const WALL_CELL = -2;

/** A pellet of food. Feeding on it pushes a bacterium beyond its normal limit. */
export interface Nutrient {
  x: number;
  y: number;
  amount: number;
}

/** A colony owns the mutable bacteria of one player. */
export interface Colony {
  playerId: number;
  color: PlayerColorArray;
  bacterias: Bacteria[];
  /** Enemy bacteria eaten since the game started. */
  captured: number;
  /** Own bacteria lost since the game started. */
  lost: number;
  /** Sum of the energy of all bacteria of this colony. */
  totalEnergy: number;
  /** Pellets it ate up since the game started - see `NutrientPellets.drain`. */
  pellets: number;
  /** How it plays differently from the balance - a boss's or evolved traits. */
  traits: EvolvedTraits;
}

export interface ColonySpawn {
  playerId: number;
  color: PlayerColorArray;
  x: number;
  y: number;
  radius: number;
  /** A boss's or evolved traits - plain when absent. */
  traits?: EvolvedTraits;
}

/**
 * What happened during one step - read by the sound, which has no business
 * looking into the grid itself.
 */
export interface StepEvents {
  /** Bacteria that changed sides or were eaten. */
  captures: number;
  /** Pellets that were eaten up. */
  pelletsEaten: number;
  /** Bacteria a closing gate or a sliding wall had no room left for. */
  crushed: number;
  /** Gates that slammed shut. */
  gatesClosed: number;
  /** Gates that started to warn that they are about to close. */
  gatesWarned: number;
}

/** How hard a colony's bacteria press this frame - its boost and traits. */
export function attackOf(
  balance: GameBalance,
  traits: ColonyTraits,
  boosted: boolean
): number {
  return traits.attackFactor * (boosted ? balance.boostAttackFactor : 1);
}

/** A bacterium's chance to divide this frame, before ground and room. */
export function divideChanceOf(
  balance: GameBalance,
  traits: ColonyTraits,
  deltaTimeSec: number
): number {
  return balance.divideChancePerSec * traits.divideFactor * deltaTimeSec;
}

/** How a colony heads for its crosshair this frame - see {@link colonyIntent}. */
export interface ColonyIntent {
  aggression: number;
  /** The cells it travels, as a plain colony does. */
  steps: number;
  /**
   * The part of a cell more its flagella make it travel - 0 without. A
   * few percent of a step would be lost to the rounding, so the simulations
   * carry it on from frame to frame (see {@link paceSteps}).
   */
  extraSteps: number;
}

/**
 * How a colony heads for its crosshair this frame: how keen it is to hunt
 * and how many cells it travels - null while it aims at nothing.
 */
export function colonyIntent(
  target: Player | null | undefined,
  balance: GameBalance,
  deltaTimeSec: number,
  traits: EvolvedTraits = PLAIN_TRAITS
): ColonyIntent | null {
  if (target == null || isNaN(target.x) || isNaN(target.y)) {
    return null;
  }
  const boosted = isBoosted(target);
  const speed = boosted
    ? target.maxSpeed * balance.boostSpeedFactor
    : target.maxSpeed;
  return {
    aggression: boosted ? balance.boostAggression : balance.aggression,
    steps: Math.max(1, Math.round(speed * deltaTimeSec)),
    extraSteps: speed * ((traits.speedFactor ?? 1) - 1) * deltaTimeSec,
  };
}

/**
 * The cells a colony travels this frame: a plain colony's, and the whole
 * ones its flagella have made up by now - what is left over is carried in
 * `paces`, by colony. A plain colony's pace never moves.
 */
export function paceSteps(
  intent: ColonyIntent,
  paces: number[] | Float64Array,
  index: number
): number {
  if (intent.extraSteps === 0) {
    return intent.steps;
  }
  const pace = (paces[index] ?? 0) + intent.extraSteps;
  const whole = Math.floor(pace);
  paces[index] = pace - whole;
  return Math.max(1, intent.steps + whole);
}

/**
 * The most cells a colony may travel in a frame: boosted, and with the
 * whole step its flagella add now and then (see {@link paceSteps}).
 */
export function maxSteps(
  target: Player,
  balance: GameBalance,
  deltaTimeSec: number,
  traits: EvolvedTraits = PLAIN_TRAITS
): number {
  const steps = target.maxSpeed * balance.boostSpeedFactor * deltaTimeSec;
  const flagella = Math.max(0, (traits.speedFactor ?? 1) - 1);
  return Math.max(1, Math.round(steps) + Math.ceil(steps * flagella));
}

export function noEvents(): StepEvents {
  return {
    captures: 0,
    pelletsEaten: 0,
    crushed: 0,
    gatesClosed: 0,
    gatesWarned: 0,
  };
}

/** The events of two steps together. */
export function addEvents(a: StepEvents, b: StepEvents): StepEvents {
  return {
    captures: a.captures + b.captures,
    pelletsEaten: a.pelletsEaten + b.pelletsEaten,
    crushed: a.crushed + b.crushed,
    gatesClosed: a.gatesClosed + b.gatesClosed,
    gatesWarned: a.gatesWarned + b.gatesWarned,
  };
}

/** A bacterium that dies this frame - and nobody captures it. */
interface Death {
  bacterium: Bacteria;
  /** Index of the colony that is losing the bacterium. */
  victim: number;
  /** Position of the bacterium inside the victim's array. */
  victimIndex: number;
}

/** A bacterium another colony killed this frame. */
interface Capture extends Death {
  /** Index of the colony that killed it. */
  winner: number;
}

const NEIGHBOURS: readonly [number, number][] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

/**
 * Grid based bacteria war simulation.
 *
 * Everything happens on an occupancy grid, one bacterium per cell. A frame runs
 * in fixed phases so the outcome never depends on the order the players are
 * iterated in:
 *
 * 1. build the occupancy grid + the coarse enemy density field
 * 2. nutrients feed whoever stands on them
 * 3. combat - outnumbered bacteria lose energy, at zero they change sides
 * 4. division - well fed bacteria clone themselves into free space
 * 5. movement - follow your player, but hunt nearby enemies
 */
export class BacteriaSimulation implements Simulation {
  public readonly kind = 'cpu';
  public readonly ruleset = 'cpu';
  private readonly balance: GameBalance;
  private readonly random: () => number;

  private width = 0;
  private height = 0;

  /** Occupancy: colony index, {@link EMPTY_CELL} or {@link WALL_CELL}. */
  private owner = new Int32Array(0);
  /** Pristine grid with only the walls in it, memcopied at the frame start. */
  private baseOwner = new Int32Array(0);
  /** The static walls alone - the moving ones are stamped on top of it. */
  private staticOwner = new Int32Array(0);
  /** The zone under each cell - see `ZONE_CODE`, 0 for none. */
  private zone = new Uint8Array(0);
  /** False on a map without zones - the lookups are skipped then. */
  private hasZones = false;
  /** True on a map with a zone to hold, whose bacteria are counted. */
  private hasHill = false;
  /** Energy snapshot of the frame start, read by the combat phase. */
  private energy = new Float32Array(0);
  /** Energy handed out by nutrients this frame. */
  private nutrientBonus = new Float32Array(0);
  /** Each colony's bacteria within reach of the pellet being drained. */
  private eaters = new Int32Array(0);
  /** Energy left behind by a kill, consumed by whoever stands there next. */
  private feed = new Float32Array(0);

  private influenceWidth = 0;
  private influenceHeight = 0;
  /** Bacteria per coarse cell, per colony. */
  private influence = new Float32Array(0);
  /** Bacteria per coarse cell, all colonies together. */
  private influenceTotal = new Float32Array(0);
  /** Unit vector per coarse cell and colony, pointing at the closest enemies. */
  private huntFieldX = new Float32Array(0);
  private huntFieldY = new Float32Array(0);

  private colonies: Colony[] = [];
  /** The summaries as of the last step, built when first asked for. */
  private colonySummaries: ColonySummary[] | null = null;
  private colonyBlocks: BlockCounts | null = null;
  private readonly pellets: NutrientPellets;
  /** Wall layout the match is fought on. */
  private map: GameMap = getMap('corridors');
  /** Match time, which drives the gates and the sliding walls. */
  private elapsedSec = 0;
  /** The moving walls and gates as of the current match time. */
  private dynamicWalls: DynamicWall[] = [];
  /** What the last step did, for the sound. */
  private events: StepEvents = noEvents();
  /** The weapons' effects - none at all in a plain match. */
  private readonly weaponEffects = new WeaponEffects();
  /** The part of a step each colony's flagella have made up - see `paceSteps`. */
  private paces: number[] = [];
  /** Which effects act on each colony, by colony index - kept from step to step. */
  private readonly hits: WeaponHits[] = [];

  constructor(
    balance: GameBalance = gameBalance,
    random: () => number = Math.random
  ) {
    this.balance = balance;
    this.random = random;
    this.pellets = new NutrientPellets(balance, random);
  }

  /**
   * Swaps the wall layout. The walls are stamped into the grid again right
   * away, so a map can be picked before the arena has its final size as well
   * as after.
   */
  public setMap(map: GameMap): void {
    if (this.map === map) {
      return;
    }
    this.map = map;
    this.stampWalls();
    this.reset();
  }

  /** True for a cell inside the arena that no wall covers. */
  private readonly isOpenCell = (x: number, y: number): boolean =>
    this.baseOwner[y * this.width + x] === EMPTY_CELL;

  /** The nutrient pellets currently on the map, for rendering. */
  public getNutrients(): Nutrient[] {
    return this.pellets.nutrients;
  }

  public getActiveEffects(): readonly ActiveEffect[] {
    return this.weaponEffects.active;
  }

  public addEffect(effect: ActiveEffect): void {
    this.weaponEffects.add(effect);
  }

  /** The moving walls and gates as they stand right now, for rendering. */
  public getDynamicWalls(): readonly DynamicWall[] {
    return this.dynamicWalls;
  }

  /** What happened during the last step. */
  public getEvents(): StepEvents {
    return this.events;
  }

  /** Count, energy, score and centre of mass of every colony. */
  public summaries(): readonly ColonySummary[] {
    this.colonySummaries ??= this.summarize();
    return this.colonySummaries;
  }

  private summarize(): ColonySummary[] {
    return this.colonies.map((colony) => {
      let sumX = 0;
      let sumY = 0;
      let onHill = 0;
      for (const bacterium of colony.bacterias) {
        sumX += bacterium.x;
        sumY += bacterium.y;
        if (
          this.hasHill &&
          this.zone[bacterium.y * this.width + bacterium.x] === ZONE_CODE.hill
        ) {
          onHill++;
        }
      }
      const count = colony.bacterias.length;
      return {
        playerId: colony.playerId,
        color: colony.color,
        count,
        captured: colony.captured,
        lost: colony.lost,
        totalEnergy: colony.totalEnergy,
        center: count > 0 ? { x: sumX / count, y: sumY / count } : null,
        onHill,
        pellets: colony.pellets,
      };
    });
  }

  public colonyLayers(boosts: ReadonlyMap<number, Point>): ColonyLayer[] {
    return this.colonies.map((colony) => ({
      kind: 'cells',
      color: colony.color,
      bacterias: colony.bacterias,
      boostTarget: boosts.get(colony.playerId) ?? null,
    }));
  }

  /**
   * Counts the bacteria into blocks as big as the GPU simulation's - once
   * per tick at the most, and only when asked.
   */
  public blockCounts(): BlockCounts {
    this.colonyBlocks ??= this.countBlocks();
    return this.colonyBlocks;
  }

  private countBlocks(): BlockCounts {
    const cellSize = this.balance.influenceCellSize;
    const blocksX = this.influenceWidth;
    const blocksY = this.influenceHeight;
    const counts = this.colonies.map((colony) => {
      const blocks = new Uint32Array(blocksX * blocksY);
      for (const bacterium of colony.bacterias) {
        blocks[
          Math.floor(bacterium.y / cellSize) * blocksX +
            Math.floor(bacterium.x / cellSize)
        ]++;
      }
      return blocks;
    });
    return { blocksX, blocksY, cellSize, counts };
  }

  /** The bacterium of another colony closest to a point, null without one. */
  public nearestEnemy(playerId: number, from: Point): Point | null {
    let nearest: Point | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const colony of this.colonies) {
      if (colony.playerId === playerId) {
        continue;
      }
      for (const bacterium of colony.bacterias) {
        const dx = bacterium.x - from.x;
        const dy = bacterium.y - from.y;
        const squared = dx * dx + dy * dy;
        if (squared < nearestDistance) {
          nearestDistance = squared;
          nearest = { x: bacterium.x, y: bacterium.y };
        }
      }
    }
    return nearest;
  }

  /** Nothing to free - everything lives on the JavaScript heap. */
  public dispose(): void {
    // The arrays go with the instance.
  }

  /** The live colonies, including their mutable bacteria, for rendering. */
  public getColonies(): readonly Colony[] {
    return this.colonies;
  }

  /** Replaces all colonies with a fresh blob per player. */
  public init(spawns: ColonySpawn[]): void {
    this.colonies = spawns.map((spawn) => ({
      playerId: spawn.playerId,
      color: spawn.color,
      bacterias: createBacteriaBlob(spawn.x, spawn.y, spawn.radius),
      captured: 0,
      lost: 0,
      totalEnergy: 0,
      pellets: 0,
      traits: spawn.traits ?? PLAIN_TRAITS,
    }));
    this.colonySummaries = null;
    this.colonyBlocks = null;
    for (const colony of this.colonies) {
      colony.totalEnergy = colony.bacterias.length * this.balance.maxEnergy;
    }
    this.elapsedSec = 0;
    this.events = noEvents();
    this.weaponEffects.clear();
    this.paces = this.colonies.map(() => 0);
    this.stampWalls();
    this.reset();
  }

  /**
   * Reallocates the grids for a new arena size and rebuilds the wall mask.
   * A no-op when the size is unchanged.
   */
  public resize(width: number, height: number): void {
    if (this.width === width && this.height === height) {
      return;
    }
    this.width = width;
    this.height = height;

    const cells = width * height;
    this.owner = new Int32Array(cells);
    this.baseOwner = new Int32Array(cells).fill(EMPTY_CELL);
    this.staticOwner = new Int32Array(cells).fill(EMPTY_CELL);
    this.zone = new Uint8Array(cells);
    this.energy = new Float32Array(cells);
    this.nutrientBonus = new Float32Array(cells);
    this.feed = new Float32Array(cells);

    this.stampWalls();

    const cellSize = this.balance.influenceCellSize;
    this.influenceWidth = Math.ceil(width / cellSize);
    this.influenceHeight = Math.ceil(height / cellSize);
    this.influenceTotal = new Float32Array(
      this.influenceWidth * this.influenceHeight
    );

    this.reset();
  }

  /** Rebuilds the pristine grid: empty everywhere but inside the walls. */
  private stampWalls(): void {
    if (this.width === 0 || this.height === 0) {
      this.dynamicWalls = [];
      return;
    }
    this.staticOwner.fill(EMPTY_CELL);
    this.zone.fill(0);
    const zones = mapZones(this.map, this.width, this.height);
    stampZones(this.zone, this.width, this.height, zones);
    this.hasZones = zones.length > 0;
    this.hasHill = zones.some(({ kind }) => kind === 'hill');
    for (const wall of this.map.createWalls(this.width, this.height)) {
      stampRect(this.staticOwner, this.width, this.height, wall, WALL_CELL);
    }
    this.dynamicWalls =
      this.map.createDynamicWalls?.(this.width, this.height, this.elapsedSec) ??
      [];
    this.stampDynamicWalls();
  }

  /** The static walls plus whatever moving wall blocks right now. */
  private stampDynamicWalls(): void {
    this.baseOwner.set(this.staticOwner);
    for (const wall of this.dynamicWalls) {
      if (wall.solid) {
        stampRect(this.baseOwner, this.width, this.height, wall, WALL_CELL);
      }
    }
  }

  /**
   * Moves the gates and sliding walls on to the current match time. Bacteria
   * a wall now covers are pushed into the nearest free cell, and crushed when
   * there is none - so a gate is worth getting out of before it closes.
   */
  private advanceDynamicWalls(): void {
    if (this.map.createDynamicWalls == null) {
      return;
    }
    const previous = this.dynamicWalls;
    const next = this.map.createDynamicWalls(
      this.width,
      this.height,
      this.elapsedSec
    );
    this.dynamicWalls = next;
    const { changed, closed, warned } = compareDynamicWalls(previous, next);
    this.events.gatesClosed += closed;
    this.events.gatesWarned += warned;
    if (!changed) {
      return;
    }
    this.stampDynamicWalls();
    this.evictFromWalls();
  }

  /**
   * Pushes bacteria out of the cells a wall has just moved into. Most moves
   * catch nobody, so the occupancy needed to find free cells is only built
   * once someone is trapped.
   */
  private evictFromWalls(): void {
    const trapped: [number, Bacteria][] = [];
    this.colonies.forEach((colony, colonyIndex) => {
      for (const bacterium of colony.bacterias) {
        if (
          this.baseOwner[bacterium.y * this.width + bacterium.x] === WALL_CELL
        ) {
          trapped.push([colonyIndex, bacterium]);
        }
      }
    });
    if (trapped.length === 0) {
      return;
    }

    this.owner.set(this.baseOwner);
    this.colonies.forEach((colony, colonyIndex) => {
      for (const bacterium of colony.bacterias) {
        const index = bacterium.y * this.width + bacterium.x;
        if (this.owner[index] !== WALL_CELL) {
          this.owner[index] = colonyIndex;
        }
      }
    });

    const crushed = new Set<Bacteria>();
    for (const [colonyIndex, bacterium] of trapped) {
      const cell = this.findEscape(bacterium.x, bacterium.y);
      if (cell < 0) {
        crushed.add(bacterium);
        this.colonies[colonyIndex].lost++;
        continue;
      }
      bacterium.x = cell % this.width;
      bacterium.y = Math.floor(cell / this.width);
      this.owner[cell] = colonyIndex;
    }
    if (crushed.size === 0) {
      return;
    }
    this.events.crushed += crushed.size;
    for (const colony of this.colonies) {
      colony.bacterias = colony.bacterias.filter((b) => !crushed.has(b));
    }
  }

  /** The closest free cell within a few steps, or -1 when it is all packed. */
  private findEscape(x: number, y: number): number {
    const reach = escapeReach(this.width, this.map.size);
    for (let radius = 1; radius <= reach; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) {
            continue;
          }
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= this.width || ny >= this.height) {
            continue;
          }
          const index = ny * this.width + nx;
          if (this.owner[index] === EMPTY_CELL) {
            return index;
          }
        }
      }
    }
    return -1;
  }

  /** Drops all nutrients and respawns a fresh set. */
  public reset(): void {
    this.pellets.reset(this.width, this.height, this.isOpenCell);
    if (this.width === 0 || this.height === 0) {
      return;
    }
    this.owner.set(this.baseOwner);
  }

  /**
   * Advances the war by one step. `players` only provides the crosshair each
   * colony moves towards - the bacteria themselves belong to the simulation.
   */
  public step(players: Player[], deltaTimeSec: number): void {
    // Reset before the guard: a frame that does nothing must not report the
    // last frame's events again.
    this.events = noEvents();
    this.colonySummaries = null;
    this.colonyBlocks = null;
    if (this.colonies.length === 0 || this.width === 0 || deltaTimeSec <= 0) {
      return;
    }

    this.elapsedSec += deltaTimeSec;
    this.advanceDynamicWalls();
    const effects = this.weaponEffects.begin();

    const targets = this.colonies.map(
      (colony) =>
        players.find((player) => player.id === colony.playerId) ?? null
    );

    // A boosted colony hits harder - the factor is read per attacking colony
    // in the combat phase, so it is resolved once here.
    const attackFactor = new Float32Array(this.colonies.length);
    targets.forEach((target, index) => {
      attackFactor[index] = attackOf(
        this.balance,
        this.colonies[index].traits,
        isBoosted(target)
      );
    });

    const hits = this.weaponHits(effects);

    this.buildGrid();
    this.updateNutrients(deltaTimeSec);
    const deaths: Death[] = [];
    const captures = this.runCombat(deltaTimeSec, attackFactor, deaths, hits);
    this.applyCaptures(captures);
    this.clearDeaths(deaths);
    this.compact([...captures, ...deaths]);
    if (effects.length > 0) {
      this.strikePhages(hits);
    }
    // Division and movement compete for the same free cells, so whoever is
    // handled first has an edge - shuffle to keep the colonies symmetric.
    this.divide(this.shuffled(), deltaTimeSec, hits);
    this.move(this.shuffled(), targets, deltaTimeSec, hits);
    this.weaponEffects.end(deltaTimeSec);

    for (const colony of this.colonies) {
      let totalEnergy = 0;
      for (const bacterium of colony.bacterias) {
        totalEnergy += bacterium.energy;
      }
      colony.totalEnergy = totalEnergy;
    }
  }

  /**
   * Which effects act on each colony this step, by colony index, sorted in
   * one pass into lists kept from step to step - a plain match allocates
   * nothing here, and every list stays empty.
   */
  private weaponHits(effects: readonly ActiveEffect[]): readonly WeaponHits[] {
    const hits = this.hits;
    const count = this.colonies.length;
    while (hits.length < count) {
      hits.push({ toughness: 1, toxins: [], cryo: [], phages: [], blooms: [] });
    }
    hits.length = count;
    for (let index = 0; index < count; index++) {
      const { playerId, traits } = this.colonies[index];
      const hit = hits[index];
      hit.toughness = toughnessOf(traits, effects, playerId);
      hit.toxins.length = 0;
      hit.cryo.length = 0;
      hit.phages.length = 0;
      hit.blooms.length = 0;
    }
    for (let e = 0; e < effects.length; e++) {
      const effect = effects[e];
      const list = HIT_LISTS[effect.weapon];
      if (list === undefined) {
        continue;
      }
      for (let index = 0; index < count; index++) {
        if (actsOn(effect, this.colonies[index].playerId)) {
          hits[index][list].push(effect);
        }
      }
    }
    return hits;
  }

  /**
   * Phages turn a share of the enemy bacteria in their circle - each one by
   * the simulation's own random numbers - into the striking colony's, with
   * the energy they have. They leave food behind as a capture does.
   */
  private strikePhages(hits: readonly WeaponHits[]): void {
    hits.forEach(({ phages }, victim) => {
      if (phages.length === 0) {
        return;
      }
      const colony = this.colonies[victim];
      // The striking colony of each phage, looked up once per strike.
      const strikers = phages.map((phage) =>
        this.colonies.findIndex(({ playerId }) => playerId === phage.owner)
      );
      const kept: Bacteria[] = [];
      for (const bacterium of colony.bacterias) {
        const struck = phages.findIndex((effect) =>
          covers(effect, bacterium.x, bacterium.y)
        );
        const winner = struck < 0 ? -1 : strikers[struck];
        if (winner < 0 || this.random() >= WEAPON_EFFECTS.phageConvertShare) {
          kept.push(bacterium);
          continue;
        }
        this.colonies[winner].bacterias.push(bacterium);
        this.colonies[winner].captured++;
        colony.lost++;
        this.events.captures++;
        this.owner[bacterium.y * this.width + bacterium.x] = winner;
        this.leaveFood(bacterium, winner);
      }
      colony.bacterias = kept;
    });
  }

  /**
   * The food a kill leaves behind, which fuels a breakthrough: on its cell,
   * and on the cells of the winning colony around it.
   */
  private leaveFood(bacterium: Bacteria, winner: number): void {
    const { feedEnergyPerCapture } = this.balance;
    this.feed[bacterium.y * this.width + bacterium.x] += feedEnergyPerCapture;
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = bacterium.x + dx;
      const ny = bacterium.y + dy;
      if (nx < 0 || ny < 0 || nx >= this.width || ny >= this.height) {
        continue;
      }
      const neighbourIndex = ny * this.width + nx;
      if (this.owner[neighbourIndex] === winner) {
        this.feed[neighbourIndex] += feedEnergyPerCapture;
      }
    }
  }

  /** The colonies in random order, so no colony is always handled first. */
  private shuffled(): Colony[] {
    const result = [...this.colonies];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Rebuilds the occupancy grid, the energy snapshot and the coarse density
   * field from the current bacteria. Combat reads the snapshot rather than the
   * live values, which keeps a frame independent of the iteration order.
   */
  private buildGrid(): void {
    this.owner.set(this.baseOwner);
    this.energy.fill(0);

    const cells = this.influenceWidth * this.influenceHeight;
    if (this.influence.length !== cells * this.colonies.length) {
      this.influence = new Float32Array(cells * this.colonies.length);
      this.huntFieldX = new Float32Array(cells * this.colonies.length);
      this.huntFieldY = new Float32Array(cells * this.colonies.length);
    } else {
      this.influence.fill(0);
    }
    this.influenceTotal.fill(0);

    const cellSize = this.balance.influenceCellSize;
    for (
      let colonyIndex = 0;
      colonyIndex < this.colonies.length;
      colonyIndex++
    ) {
      const offset = colonyIndex * cells;
      const bacterias = this.colonies[colonyIndex].bacterias;
      for (let i = 0; i < bacterias.length; i++) {
        const bacterium = bacterias[i];
        const x = clamp(Math.round(bacterium.x), 0, this.width - 1);
        const y = clamp(Math.round(bacterium.y), 0, this.height - 1);
        bacterium.x = x;
        bacterium.y = y;

        const index = y * this.width + x;
        this.owner[index] = colonyIndex;
        this.energy[index] = bacterium.energy;

        const influenceIndex =
          Math.floor(y / cellSize) * this.influenceWidth +
          Math.floor(x / cellSize);
        this.influence[offset + influenceIndex]++;
        this.influenceTotal[influenceIndex]++;
      }
    }

    this.buildHuntField(this.colonies.length);
  }

  /**
   * Turns the coarse density field into one hunting direction per coarse cell,
   * so the movement phase only has to look the answer up.
   */
  private buildHuntField(colonyCount: number): void {
    const cells = this.influenceWidth * this.influenceHeight;
    for (let colony = 0; colony < colonyCount; colony++) {
      const offset = colony * cells;
      for (let cy = 0; cy < this.influenceHeight; cy++) {
        for (let cx = 0; cx < this.influenceWidth; cx++) {
          const cell = cy * this.influenceWidth + cx;
          let dirX = 0;
          let dirY = 0;
          for (const [dx, dy] of NEIGHBOURS) {
            const gx = cx + dx;
            const gy = cy + dy;
            if (
              gx < 0 ||
              gy < 0 ||
              gx >= this.influenceWidth ||
              gy >= this.influenceHeight
            ) {
              continue;
            }
            const index = gy * this.influenceWidth + gx;
            const enemies =
              this.influenceTotal[index] - this.influence[offset + index];
            if (enemies > 0) {
              dirX += dx * enemies;
              dirY += dy * enemies;
            }
          }
          const length = Math.sqrt(dirX * dirX + dirY * dirY);
          this.huntFieldX[offset + cell] = length > 0 ? dirX / length : 0;
          this.huntFieldY[offset + cell] = length > 0 ? dirY / length : 0;
        }
      }
    }
  }

  /**
   * Lets every bacterium standing on a pellet drain it, and respawns pellets
   * that have been emptied.
   */
  private updateNutrients(deltaTimeSec: number): void {
    this.nutrientBonus.fill(0);
    const { nutrientRadius, nutrientDrainPerSec } = this.balance;
    const gain = nutrientDrainPerSec * deltaTimeSec;
    const nutrients = this.pellets.nutrients;
    if (this.eaters.length !== this.colonies.length) {
      this.eaters = new Int32Array(this.colonies.length);
    }
    const eaters = this.eaters;

    for (let n = 0; n < nutrients.length; n++) {
      const nutrient = nutrients[n];
      if (nutrient.amount <= 0) {
        this.pellets.tickEmpty(n, deltaTimeSec);
        continue;
      }

      const xMin = Math.max(nutrient.x - nutrientRadius, 0);
      const xMax = Math.min(nutrient.x + nutrientRadius, this.width - 1);
      const yMin = Math.max(nutrient.y - nutrientRadius, 0);
      const yMax = Math.min(nutrient.y + nutrientRadius, this.height - 1);

      eaters.fill(0);
      for (let y = yMin; y <= yMax; y++) {
        for (let x = xMin; x <= xMax; x++) {
          const index = y * this.width + x;
          if (this.owner[index] < 0) {
            continue;
          }
          this.nutrientBonus[index] += gain;
          eaters[this.owner[index]]++;
        }
      }

      const eaten = this.pellets.drain(n, eaters, gain);
      if (eaten !== null) {
        this.events.pelletsEaten++;
        if (eaten.by !== null) {
          this.colonies[eaten.by].pellets++;
        }
      }
    }
  }

  /**
   * Applies nutrient gain, combat drain and regeneration to every bacterium and
   * collects the ones that ran out of energy.
   *
   * `attackFactor` scales the pressure each colony exerts - a boosted colony's
   * bacteria count for more than their energy alone. The ones an antibiotic
   * killed go into `deaths`.
   */
  private runCombat(
    deltaTimeSec: number,
    attackFactor: Float32Array,
    deaths: Death[],
    hits: readonly WeaponHits[]
  ): Capture[] {
    const {
      defenceFactor,
      frontlinePressure,
      combatDrainPerSec,
      energyRegenPerSec,
      overchargeDecayPerSec,
      maxEnergy,
      superChargedMaxEnergy,
    } = this.balance;

    const captures: Capture[] = [];
    const enemyStrength = new Float32Array(this.colonies.length);

    for (
      let colonyIndex = 0;
      colonyIndex < this.colonies.length;
      colonyIndex++
    ) {
      const bacterias = this.colonies[colonyIndex].bacterias;
      // 1 for a plain colony: the pressure times 1 is the pressure, exactly.
      const { toughness, toxins, cryo } = hits[colonyIndex];
      for (let i = 0; i < bacterias.length; i++) {
        const bacterium = bacterias[i];
        const { x, y } = bacterium;
        const index = y * this.width + x;

        enemyStrength.fill(0);
        let enemy = 0;
        let own = 0;
        for (const [dx, dy] of NEIGHBOURS) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= this.width || ny >= this.height) {
            continue;
          }
          const neighbourIndex = ny * this.width + nx;
          const neighbour = this.owner[neighbourIndex];
          if (neighbour < 0) {
            continue;
          }
          const neighbourEnergy = this.energy[neighbourIndex];
          if (neighbour === colonyIndex) {
            own += neighbourEnergy;
          } else {
            const strength = neighbourEnergy * attackFactor[neighbour];
            enemy += strength;
            enemyStrength[neighbour] += strength;
          }
        }

        let energy =
          bacterium.energy + this.nutrientBonus[index] + this.feed[index];

        const antibiotic =
          this.hasZones && this.zone[index] === ZONE_CODE.antibiotic;
        if (antibiotic) {
          energy -= ZONE_EFFECTS.antibioticDrainPerSec * deltaTimeSec;
        }
        // An enemy's toxin cloud drains like antibiotic ground, only harder.
        const toxic = toxins.length > 0 && anyCovers(toxins, x, y);
        if (toxic) {
          energy -= WEAPON_EFFECTS.toxinDrainPerSec * deltaTimeSec;
        }
        const poisoned = antibiotic || toxic;
        // Frozen by an enemy's cryo pulse, it does not recover either.
        const frozen = cryo.length > 0 && anyCovers(cryo, x, y);
        const pressure =
          enemy > 0 ? enemy + frontlinePressure - own * defenceFactor : 0;
        if (pressure > 0) {
          energy -= pressure * toughness * combatDrainPerSec * deltaTimeSec;
        } else if (energy < maxEnergy && !poisoned && !frozen) {
          energy = Math.min(
            maxEnergy,
            energy + energyRegenPerSec * deltaTimeSec
          );
        }

        if (energy > maxEnergy) {
          energy = Math.min(
            superChargedMaxEnergy,
            Math.max(maxEnergy, energy - overchargeDecayPerSec * deltaTimeSec)
          );
        }

        if (energy > 0) {
          bacterium.energy = energy;
          continue;
        }

        const winner = strongestEnemy(enemyStrength, colonyIndex);
        if (winner < 0 && poisoned) {
          // The antibiotic or the toxin killed it: lost, and nobody
          // captured it.
          this.colonies[colonyIndex].lost++;
          deaths.push({ bacterium, victim: colonyIndex, victimIndex: i });
          continue;
        }
        if (winner < 0) {
          // Nothing around that could take over - stay alive on fumes.
          bacterium.energy = Math.min(
            maxEnergy,
            energyRegenPerSec * deltaTimeSec
          );
          continue;
        }
        this.colonies[colonyIndex].lost++;
        captures.push({
          bacterium,
          victim: colonyIndex,
          victimIndex: i,
          winner,
        });
      }
    }

    return captures;
  }

  /**
   * Hands every killed bacterium to its killer, or digests it entirely, and
   * leaves energy behind on the cell either way.
   */
  private applyCaptures(captures: Capture[]): void {
    this.feed.fill(0);
    if (captures.length === 0) {
      return;
    }
    const { captureEnergy, consumeChance } = this.balance;
    this.events.captures += captures.length;

    for (const capture of captures) {
      const colony = this.colonies[capture.winner];
      const bacterium = capture.bacterium;
      const index = bacterium.y * this.width + bacterium.x;
      colony.captured++;

      if (this.random() < consumeChance) {
        // Digested completely: the cell frees up and the carrying capacity of
        // the arena drops, so both sides can grow into the gap again.
        this.owner[index] = EMPTY_CELL;
        this.energy[index] = 0;
      } else {
        bacterium.energy = captureEnergy;
        colony.bacterias.push(bacterium);
        this.owner[index] = capture.winner;
        this.energy[index] = captureEnergy;
      }

      this.leaveFood(bacterium, capture.winner);
    }
  }

  /** Frees the cells of the bacteria that died without a captor. */
  private clearDeaths(deaths: readonly Death[]): void {
    for (const { bacterium } of deaths) {
      const index = bacterium.y * this.width + bacterium.x;
      this.owner[index] = EMPTY_CELL;
      this.energy[index] = 0;
    }
  }

  /** Removes the bacteria that were killed this frame from their old colony. */
  private compact(captures: readonly Death[]): void {
    if (captures.length === 0) {
      return;
    }
    const removed = new Map<number, Set<number>>();
    for (const capture of captures) {
      let indices = removed.get(capture.victim);
      if (indices == null) {
        indices = new Set<number>();
        removed.set(capture.victim, indices);
      }
      indices.add(capture.victimIndex);
    }
    for (const [colonyIndex, indices] of removed) {
      const colony = this.colonies[colonyIndex];
      colony.bacterias = colony.bacterias.filter((_, i) => !indices.has(i));
    }
  }

  /**
   * Lets well fed bacteria clone themselves into a free neighbouring cell until
   * the arena reaches its carrying capacity.
   */
  private divide(
    colonies: Colony[],
    deltaTimeSec: number,
    hits: readonly WeaponHits[]
  ): void {
    const { divideEnergyThreshold, parentEnergyShare } = this.balance;
    const capacity = colonyCapacity(this.balance, this.colonies.length);

    for (const colony of colonies) {
      const colonyIndex = this.colonies.indexOf(colony);
      const chance = divideChanceOf(this.balance, colony.traits, deltaTimeSec);
      const { blooms, cryo } = hits[colonyIndex];
      const bacterias = colony.bacterias;
      let count = bacterias.length;
      const parents = count;
      for (let i = 0; i < parents && count < capacity; i++) {
        const bacterium = bacterias[i];
        if (bacterium.energy < divideEnergyThreshold) {
          continue;
        }
        const onAgar =
          this.hasZones &&
          this.zone[bacterium.y * this.width + bacterium.x] === ZONE_CODE.agar;
        const groundChance = onAgar
          ? chance * ZONE_EFFECTS.agarDivideFactor
          : chance;
        if (
          this.random() >=
          (blooms.length > 0 || cryo.length > 0
            ? groundChance * effectDivideFactor(bacterium, blooms, cryo)
            : groundChance)
        ) {
          continue;
        }
        const cell = this.findFreeNeighbour(bacterium.x, bacterium.y);
        if (cell < 0) {
          continue;
        }
        const childEnergy = bacterium.energy * (1 - parentEnergyShare);
        bacterium.energy *= parentEnergyShare;
        const child: Bacteria = {
          x: cell % this.width,
          y: Math.floor(cell / this.width),
          energy: childEnergy,
        };
        this.owner[cell] = colonyIndex;
        this.energy[cell] = childEnergy;
        bacterias.push(child);
        count++;
      }
    }
  }

  /** Index of a random free neighbouring cell, or -1 when there is none. */
  private findFreeNeighbour(x: number, y: number): number {
    const start = Math.floor(this.random() * NEIGHBOURS.length);
    for (let k = 0; k < NEIGHBOURS.length; k++) {
      const [dx, dy] = NEIGHBOURS[(start + k) % NEIGHBOURS.length];
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= this.width || ny >= this.height) {
        continue;
      }
      const index = ny * this.width + nx;
      if (this.owner[index] === EMPTY_CELL) {
        return index;
      }
    }
    return -1;
  }

  /**
   * Moves every bacterium towards its player's crosshair, biased towards nearby
   * enemies so the colonies actively seek each other out.
   *
   * A boosted colony moves faster and hunts harder for as long as the boost
   * lasts - that is the whole point of firing one.
   */
  private move(
    colonies: Colony[],
    targets: (Player | null)[],
    deltaTimeSec: number,
    hits: readonly WeaponHits[]
  ): void {
    const { jitter, influenceCellSize: cellSize } = this.balance;
    const cells = this.influenceWidth * this.influenceHeight;

    for (const colony of colonies) {
      const colonyIndex = this.colonies.indexOf(colony);
      const target = targets[colonyIndex];
      const intent = colonyIntent(
        target,
        this.balance,
        deltaTimeSec,
        colony.traits
      );
      if (target == null || intent == null) {
        continue;
      }
      const { cryo } = hits[colonyIndex];
      const huntOffset = colonyIndex * cells;
      const { x: targetX, y: targetY } = target;
      const { aggression } = intent;
      const maxStep = paceSteps(intent, this.paces, colonyIndex);

      for (const bacterium of colony.bacterias) {
        const zone = this.hasZones
          ? this.zone[bacterium.y * this.width + bacterium.x]
          : 0;
        if (
          zone === ZONE_CODE.ice &&
          this.random() < ZONE_EFFECTS.iceStayChance
        ) {
          continue;
        }
        // Frozen by an enemy's cryo pulse, it all but sits the step out.
        if (
          cryo.length > 0 &&
          anyCovers(cryo, bacterium.x, bacterium.y) &&
          this.random() < WEAPON_EFFECTS.cryoStayChance
        ) {
          continue;
        }
        const hunt =
          zone === ZONE_CODE.heat ? heatedAggression(aggression) : aggression;
        let dirX = targetX - bacterium.x;
        let dirY = targetY - bacterium.y;
        const length = Math.sqrt(dirX * dirX + dirY * dirY);
        if (length > 0) {
          dirX /= length;
          dirY /= length;
        }

        const huntCell =
          huntOffset +
          Math.floor(bacterium.y / cellSize) * this.influenceWidth +
          Math.floor(bacterium.x / cellSize);
        let huntX = this.huntFieldX[huntCell];
        let huntY = this.huntFieldY[huntCell];
        // The hunt never drags a colony back against its crosshair: the
        // part of it that points away from the crosshair is dropped, so a
        // colony can always run - it only bends sideways towards the enemy.
        const back = huntX * dirX + huntY * dirY;
        if (back < 0) {
          huntX -= back * dirX;
          huntY -= back * dirY;
        }
        if (huntX !== 0 || huntY !== 0) {
          dirX = dirX * (1 - hunt) + huntX * hunt;
          dirY = dirY * (1 - hunt) + huntY * hunt;
        }

        dirX += (this.random() - 0.5) * jitter;
        dirY += (this.random() - 0.5) * jitter;

        const blended = Math.sqrt(dirX * dirX + dirY * dirY);
        if (blended === 0) {
          continue;
        }
        this.tryMove(
          bacterium,
          colonyIndex,
          dirX / blended,
          dirY / blended,
          maxStep
        );
      }
    }
  }

  /**
   * Moves a bacterium as far along `dir` as it can get.
   *
   * The ray is walked outwards cell by cell and stops at the first blocked one.
   * Jumping straight to the furthest cell would let a bacterium tunnel through a
   * wall whenever a long frame makes `maxStep` exceed the wall thickness.
   */
  private tryMove(
    bacterium: Bacteria,
    colonyIndex: number,
    dirX: number,
    dirY: number,
    maxStep: number
  ): boolean {
    let reachedX = 0;
    let reachedY = 0;
    for (let step = 1; step <= maxStep; step++) {
      const dx = Math.round(dirX * step);
      const dy = Math.round(dirY * step);
      if (dx === reachedX && dy === reachedY) {
        continue;
      }
      if (!this.isFree(bacterium.x + dx, bacterium.y + dy)) {
        break;
      }
      reachedX = dx;
      reachedY = dy;
    }
    if (this.occupy(bacterium, colonyIndex, reachedX, reachedY)) {
      return true;
    }
    // Blocked head on - slide along the wall instead of piling up in front of it.
    const slideFirst = this.random() < 0.5;
    const slides: [number, number][] = [
      [Math.sign(dirX), 0],
      [0, Math.sign(dirY)],
    ];
    if (!slideFirst) {
      slides.reverse();
    }
    for (const [dx, dy] of slides) {
      if (this.occupy(bacterium, colonyIndex, dx, dy)) {
        return true;
      }
    }
    const [dx, dy] = NEIGHBOURS[Math.floor(this.random() * NEIGHBOURS.length)];
    return this.occupy(bacterium, colonyIndex, dx, dy);
  }

  /** True when the cell is inside the arena and neither wall nor bacterium. */
  private isFree(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return false;
    }
    return this.owner[y * this.width + x] === EMPTY_CELL;
  }

  /** Moves a bacterium by the given offset if the target cell is free. */
  private occupy(
    bacterium: Bacteria,
    colonyIndex: number,
    dx: number,
    dy: number
  ): boolean {
    if (dx === 0 && dy === 0) {
      return false;
    }
    const toX = clamp(bacterium.x + dx, 0, this.width - 1);
    const toY = clamp(bacterium.y + dy, 0, this.height - 1);
    if (toX === bacterium.x && toY === bacterium.y) {
      return false;
    }
    const to = toY * this.width + toX;
    if (this.owner[to] !== EMPTY_CELL) {
      return false;
    }
    const from = bacterium.y * this.width + bacterium.x;
    this.owner[from] = EMPTY_CELL;
    this.energy[from] = 0;
    this.owner[to] = colonyIndex;
    this.energy[to] = bacterium.energy;
    bacterium.x = toX;
    bacterium.y = toY;
    return true;
  }
}

/** The weapons' effects acting on one colony in a step. */
interface WeaponHits {
  /** Times the pressure on its bacteria. */
  toughness: number;
  /** Enemies' toxin clouds. */
  toxins: ActiveEffect[];
  /** Enemies' cryo pulses. */
  cryo: ActiveEffect[];
  /** Enemies' phage strikes - a strike acts in one step only. */
  phages: ActiveEffect[];
  /** Its own agar blooms. */
  blooms: ActiveEffect[];
}

/**
 * The list of {@link WeaponHits} each weapon's effects go into - the shield
 * goes into none: it acts through the toughness.
 */
const HIT_LISTS: Readonly<
  Partial<Record<WeaponId, Exclude<keyof WeaponHits, 'toughness'>>>
> = {
  'toxin-bomb': 'toxins',
  'cryo-pulse': 'cryo',
  'phage-strike': 'phages',
  'agar-bloom': 'blooms',
};

/** Times a bacterium's chance to divide from a bloom and a freeze. */
function effectDivideFactor(
  { x, y }: Bacteria,
  blooms: readonly ActiveEffect[],
  cryo: readonly ActiveEffect[]
): number {
  return (
    (anyCovers(blooms, x, y) ? WEAPON_EFFECTS.agarBloomDivideFactor : 1) *
    (anyCovers(cryo, x, y) ? WEAPON_EFFECTS.cryoDivideFactor : 1)
  );
}

/** Index of the enemy colony with the most energy around a cell, else -1. */
function strongestEnemy(enemyStrength: Float32Array, ownIndex: number): number {
  let winner = -1;
  let best = 0;
  for (let i = 0; i < enemyStrength.length; i++) {
    if (i === ownIndex) {
      continue;
    }
    if (enemyStrength[i] > best) {
      best = enemyStrength[i];
      winner = i;
    }
  }
  return winner;
}
