import { GameBalance, gameBalance } from './game-balance';
import { clamp, Point } from './geometry';
import { NutrientPellets } from './nutrient-pellets';
import { ColonySummary, Simulation } from './simulation';
import { DynamicWall, GameMap, getMap, Rect } from './maps';
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
}

export interface ColonySpawn {
  playerId: number;
  color: PlayerColorArray;
  x: number;
  y: number;
  radius: number;
}

/**
 * What happened during one frame - read by the sound, which has no business
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

/** A frame in which nothing happened. */
export function noEvents(): StepEvents {
  return {
    captures: 0,
    pelletsEaten: 0,
    crushed: 0,
    gatesClosed: 0,
    gatesWarned: 0,
  };
}

interface Capture {
  bacterium: Bacteria;
  /** Index of the colony that is losing the bacterium. */
  victim: number;
  /** Position of the bacterium inside the victim's array. */
  victimIndex: number;
  /** Index of the colony that killed it. */
  winner: number;
}

/** How far a moving wall may shove a bacterium before it crushes it. */
const ESCAPE_RADIUS = 3;

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
  /** Energy snapshot of the frame start, read by the combat phase. */
  private energy = new Float32Array(0);
  /** Energy handed out by nutrients this frame. */
  private nutrientBonus = new Float32Array(0);
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
  private readonly pellets: NutrientPellets;
  /** Wall layout the match is fought on. */
  private map: GameMap = getMap('corridors');
  /** Match time, which drives the gates and the sliding walls. */
  private elapsedSec = 0;
  /** The moving walls and gates as of the current match time. */
  private dynamicWalls: DynamicWall[] = [];
  /** What the last frame did, for the sound. */
  private events: StepEvents = noEvents();

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

  /** The moving walls and gates as they stand right now, for rendering. */
  public getDynamicWalls(): readonly DynamicWall[] {
    return this.dynamicWalls;
  }

  /** What happened during the last frame. */
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
      for (const bacterium of colony.bacterias) {
        sumX += bacterium.x;
        sumY += bacterium.y;
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
      };
    });
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
    }));
    this.colonySummaries = null;
    for (const colony of this.colonies) {
      colony.totalEnergy = colony.bacterias.length * this.balance.maxEnergy;
    }
    this.elapsedSec = 0;
    this.events = noEvents();
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
    for (const wall of this.map.createWalls(this.width, this.height)) {
      this.stampRect(this.staticOwner, wall);
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
        this.stampRect(this.baseOwner, wall);
      }
    }
  }

  private stampRect(grid: Int32Array, rect: Rect): void {
    const xMax = Math.min(rect.x + rect.width, this.width);
    const yMax = Math.min(rect.y + rect.height, this.height);
    for (let y = Math.max(rect.y, 0); y < yMax; y++) {
      for (let x = Math.max(rect.x, 0); x < xMax; x++) {
        grid[y * this.width + x] = WALL_CELL;
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

    let changed = next.length !== previous.length;
    for (let i = 0; i < next.length; i++) {
      const before = previous[i];
      const after = next[i];
      if (before == null) {
        continue;
      }
      if (after.solid && !before.solid) {
        this.events.gatesClosed++;
      }
      if (after.warning > 0 && before.warning === 0) {
        this.events.gatesWarned++;
      }
      changed ||=
        after.solid !== before.solid ||
        after.x !== before.x ||
        after.y !== before.y ||
        after.width !== before.width ||
        after.height !== before.height;
    }
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
    for (let radius = 1; radius <= ESCAPE_RADIUS; radius++) {
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
   * Advances the war by one frame. `players` only provides the crosshair each
   * colony moves towards - the bacteria themselves belong to the simulation.
   */
  public step(players: Player[], deltaTimeSec: number): void {
    // Reset before the guard: a frame that does nothing must not report the
    // last frame's events again.
    this.events = noEvents();
    this.colonySummaries = null;
    if (this.colonies.length === 0 || this.width === 0 || deltaTimeSec <= 0) {
      return;
    }

    this.elapsedSec += deltaTimeSec;
    this.advanceDynamicWalls();

    const targets = this.colonies.map(
      (colony) =>
        players.find((player) => player.id === colony.playerId) ?? null
    );

    // A boosted colony hits harder - the factor is read per attacking colony
    // in the combat phase, so it is resolved once here.
    const attackFactor = new Float32Array(this.colonies.length).fill(1);
    targets.forEach((target, index) => {
      if (isBoosted(target)) {
        attackFactor[index] = this.balance.boostAttackFactor;
      }
    });

    this.buildGrid();
    this.updateNutrients(deltaTimeSec);
    const captures = this.runCombat(deltaTimeSec, attackFactor);
    this.applyCaptures(captures);
    this.compact(captures);
    // Division and movement compete for the same free cells, so whoever is
    // handled first has an edge - shuffle to keep the colonies symmetric.
    this.divide(this.shuffled(), deltaTimeSec);
    this.move(this.shuffled(), targets, deltaTimeSec);

    for (const colony of this.colonies) {
      let totalEnergy = 0;
      for (const bacterium of colony.bacterias) {
        totalEnergy += bacterium.energy;
      }
      colony.totalEnergy = totalEnergy;
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

    for (let n = 0; n < nutrients.length; n++) {
      const nutrient = nutrients[n];
      if (nutrient.amount <= 0) {
        this.pellets.tickEmpty(
          n,
          deltaTimeSec,
          this.width,
          this.height,
          this.isOpenCell
        );
        continue;
      }

      const xMin = Math.max(nutrient.x - nutrientRadius, 0);
      const xMax = Math.min(nutrient.x + nutrientRadius, this.width - 1);
      const yMin = Math.max(nutrient.y - nutrientRadius, 0);
      const yMax = Math.min(nutrient.y + nutrientRadius, this.height - 1);

      let eaters = 0;
      for (let y = yMin; y <= yMax; y++) {
        for (let x = xMin; x <= xMax; x++) {
          const index = y * this.width + x;
          if (this.owner[index] < 0) {
            continue;
          }
          this.nutrientBonus[index] += gain;
          eaters++;
        }
      }

      if (this.pellets.drain(n, eaters, gain)) {
        this.events.pelletsEaten++;
      }
    }
  }

  /**
   * Applies nutrient gain, combat drain and regeneration to every bacterium and
   * collects the ones that ran out of energy.
   *
   * `attackFactor` scales the pressure each colony exerts - a boosted colony's
   * bacteria count for more than their energy alone.
   */
  private runCombat(
    deltaTimeSec: number,
    attackFactor: Float32Array
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

        const pressure =
          enemy > 0 ? enemy + frontlinePressure - own * defenceFactor : 0;
        if (pressure > 0) {
          energy -= pressure * combatDrainPerSec * deltaTimeSec;
        } else if (energy < maxEnergy) {
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
    const { captureEnergy, feedEnergyPerCapture, consumeChance } = this.balance;
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

      // The kill leaves food behind, which fuels a breakthrough.
      this.feed[index] += feedEnergyPerCapture;
      for (const [dx, dy] of NEIGHBOURS) {
        const nx = bacterium.x + dx;
        const ny = bacterium.y + dy;
        if (nx < 0 || ny < 0 || nx >= this.width || ny >= this.height) {
          continue;
        }
        const neighbourIndex = ny * this.width + nx;
        if (this.owner[neighbourIndex] === capture.winner) {
          this.feed[neighbourIndex] += feedEnergyPerCapture;
        }
      }
    }
  }

  /** Removes the bacteria that were killed this frame from their old colony. */
  private compact(captures: Capture[]): void {
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
  private divide(colonies: Colony[], deltaTimeSec: number): void {
    const {
      divideEnergyThreshold,
      divideChancePerSec,
      parentEnergyShare,
      maxBacteriaPerPlayer,
      maxTotalBacteria,
    } = this.balance;
    const chance = divideChancePerSec * deltaTimeSec;
    // Every colony gets its own share of the arena's carrying capacity. A
    // single budget for all of them would let the bigger colony use it up and
    // freeze the smaller one out of dividing altogether.
    const capacity = Math.max(
      1,
      Math.min(
        maxBacteriaPerPlayer,
        Math.floor(maxTotalBacteria / Math.max(1, this.colonies.length))
      )
    );

    for (const colony of colonies) {
      const colonyIndex = this.colonies.indexOf(colony);
      const bacterias = colony.bacterias;
      let count = bacterias.length;
      const parents = count;
      for (let i = 0; i < parents && count < capacity; i++) {
        const bacterium = bacterias[i];
        if (bacterium.energy < divideEnergyThreshold) {
          continue;
        }
        if (this.random() >= chance) {
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
    deltaTimeSec: number
  ): void {
    const {
      jitter,
      influenceCellSize: cellSize,
      boostSpeedFactor,
      boostAggression,
    } = this.balance;
    const cells = this.influenceWidth * this.influenceHeight;

    for (const colony of colonies) {
      const colonyIndex = this.colonies.indexOf(colony);
      const target = targets[colonyIndex];
      if (target == null) {
        continue;
      }
      const huntOffset = colonyIndex * cells;
      const { x: targetX, y: targetY, maxSpeed } = target;
      if (isNaN(targetX) || isNaN(targetY)) {
        continue;
      }
      const boosted = isBoosted(target);
      const aggression = boosted ? boostAggression : this.balance.aggression;
      const speed = boosted ? maxSpeed * boostSpeedFactor : maxSpeed;
      const maxStep = Math.max(1, Math.round(speed * deltaTimeSec));

      for (const bacterium of colony.bacterias) {
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
        const huntX = this.huntFieldX[huntCell];
        const huntY = this.huntFieldY[huntCell];
        if (huntX !== 0 || huntY !== 0) {
          dirX = dirX * (1 - aggression) + huntX * aggression;
          dirY = dirY * (1 - aggression) + huntY * aggression;
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
