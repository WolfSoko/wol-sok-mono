import { createWalls, GameBalance, gameBalance } from './game-balance';
import {
  Bacteria,
  createBacteriaBlob,
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

interface Capture {
  bacterium: Bacteria;
  /** Index of the colony that is losing the bacterium. */
  victim: number;
  /** Position of the bacterium inside the victim's array. */
  victimIndex: number;
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
export class BacteriaSimulation {
  private readonly balance: GameBalance;
  private readonly random: () => number;

  private width = 0;
  private height = 0;

  /** Occupancy: colony index, {@link EMPTY_CELL} or {@link WALL_CELL}. */
  private owner = new Int32Array(0);
  /** Pristine grid with only the walls in it, memcopied at the frame start. */
  private baseOwner = new Int32Array(0);
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
  private nutrients: Nutrient[] = [];
  private respawnTimers: number[] = [];

  constructor(
    balance: GameBalance = gameBalance,
    random: () => number = Math.random
  ) {
    this.balance = balance;
    this.random = random;
  }

  public getNutrients(): Nutrient[] {
    return this.nutrients;
  }

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
    for (const colony of this.colonies) {
      colony.totalEnergy = colony.bacterias.length * this.balance.maxEnergy;
    }
    this.reset();
  }

  public resize(width: number, height: number): void {
    if (this.width === width && this.height === height) {
      return;
    }
    this.width = width;
    this.height = height;

    const cells = width * height;
    this.owner = new Int32Array(cells);
    this.baseOwner = new Int32Array(cells).fill(EMPTY_CELL);
    this.energy = new Float32Array(cells);
    this.nutrientBonus = new Float32Array(cells);
    this.feed = new Float32Array(cells);

    for (const wall of createWalls(width, height)) {
      const xMax = Math.min(wall.x + wall.width, width);
      const yMax = Math.min(wall.y + wall.height, height);
      for (let y = Math.max(wall.y, 0); y < yMax; y++) {
        for (let x = Math.max(wall.x, 0); x < xMax; x++) {
          this.baseOwner[y * width + x] = WALL_CELL;
        }
      }
    }

    const cellSize = this.balance.influenceCellSize;
    this.influenceWidth = Math.ceil(width / cellSize);
    this.influenceHeight = Math.ceil(height / cellSize);
    this.influenceTotal = new Float32Array(
      this.influenceWidth * this.influenceHeight
    );

    this.reset();
  }

  /** Drops all nutrients and respawns a fresh set. */
  public reset(): void {
    this.nutrients = [];
    this.respawnTimers = [];
    if (this.width === 0 || this.height === 0) {
      return;
    }
    this.owner.set(this.baseOwner);
    for (let i = 0; i < this.balance.nutrientCount; i++) {
      this.nutrients.push({ x: 0, y: 0, amount: 0 });
      this.respawnTimers.push(0);
    }
    for (let i = 0; i < this.nutrients.length; i += 2) {
      this.spawnNutrientPair(i);
    }
  }

  /**
   * Advances the war by one frame. `players` only provides the crosshair each
   * colony moves towards - the bacteria themselves belong to the simulation.
   */
  public step(players: Player[], deltaTimeSec: number): void {
    if (this.colonies.length === 0 || this.width === 0 || deltaTimeSec <= 0) {
      return;
    }

    const targets = this.colonies.map(
      (colony) =>
        players.find((player) => player.id === colony.playerId) ?? null
    );

    this.buildGrid();
    this.updateNutrients(deltaTimeSec);
    const captures = this.runCombat(deltaTimeSec);
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

  private shuffled(): Colony[] {
    const result = [...this.colonies];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

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

  private updateNutrients(deltaTimeSec: number): void {
    this.nutrientBonus.fill(0);
    const { nutrientRadius, nutrientDrainPerSec, nutrientRespawnDelaySec } =
      this.balance;
    const gain = nutrientDrainPerSec * deltaTimeSec;

    for (let n = 0; n < this.nutrients.length; n++) {
      const nutrient = this.nutrients[n];
      if (nutrient.amount <= 0) {
        this.respawnTimers[n] -= deltaTimeSec;
        if (this.respawnTimers[n] <= 0) {
          this.spawnNutrientPair(n - (n % 2));
        }
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

      if (eaters > 0) {
        nutrient.amount -= eaters * gain;
        if (nutrient.amount <= 0) {
          nutrient.amount = 0;
          this.respawnTimers[n] = nutrientRespawnDelaySec;
        }
      }
    }
  }

  private runCombat(deltaTimeSec: number): Capture[] {
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
            enemy += neighbourEnergy;
            enemyStrength[neighbour] += neighbourEnergy;
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

  private applyCaptures(captures: Capture[]): void {
    this.feed.fill(0);
    if (captures.length === 0) {
      return;
    }
    const { captureEnergy, feedEnergyPerCapture, consumeChance } = this.balance;

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

  private divide(colonies: Colony[], deltaTimeSec: number): void {
    const {
      divideEnergyThreshold,
      divideChancePerSec,
      parentEnergyShare,
      maxBacteriaPerPlayer,
      maxTotalBacteria,
    } = this.balance;
    const chance = divideChancePerSec * deltaTimeSec;
    let total = colonies.reduce(
      (sum, colony) => sum + colony.bacterias.length,
      0
    );

    for (const colony of colonies) {
      const colonyIndex = this.colonies.indexOf(colony);
      const bacterias = colony.bacterias;
      let count = bacterias.length;
      const parents = count;
      for (
        let i = 0;
        i < parents && count < maxBacteriaPerPlayer && total < maxTotalBacteria;
        i++
      ) {
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
        total++;
      }
    }
  }

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

  private move(
    colonies: Colony[],
    targets: (Player | null)[],
    deltaTimeSec: number
  ): void {
    const { aggression, jitter, influenceCellSize: cellSize } = this.balance;
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
      const maxStep = Math.max(1, Math.round(maxSpeed * deltaTimeSec));

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

  private tryMove(
    bacterium: Bacteria,
    colonyIndex: number,
    dirX: number,
    dirY: number,
    maxStep: number
  ): boolean {
    for (let step = maxStep; step >= 1; step--) {
      if (
        this.occupy(
          bacterium,
          colonyIndex,
          Math.round(dirX * step),
          Math.round(dirY * step)
        )
      ) {
        return true;
      }
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

  /**
   * Places a nutrient and its partner at two points that are mirrored through
   * the centre of the arena, so both players always get the same offer.
   */
  private spawnNutrientPair(first: number): void {
    const { x, y } = this.findNutrientSpot();
    const amount = this.balance.nutrientEnergy;
    this.nutrients[first] = { x, y, amount };
    this.respawnTimers[first] = 0;

    const partner = first + 1;
    if (partner < this.nutrients.length) {
      this.nutrients[partner] = {
        x: this.width - 1 - x,
        y: this.height - 1 - y,
        amount,
      };
      this.respawnTimers[partner] = 0;
    }
  }

  private findNutrientSpot(): { x: number; y: number } {
    const margin = this.balance.nutrientRadius + 2;
    const spanX = Math.max(1, this.width - 2 * margin);
    const spanY = Math.max(1, this.height - 2 * margin);
    for (let attempt = 0; attempt < 40; attempt++) {
      const x = margin + Math.floor(this.random() * spanX);
      const y = margin + Math.floor(this.random() * spanY);
      // The walls are point symmetric, so a free spot has a free mirror image.
      if (this.baseOwner[y * this.width + x] === EMPTY_CELL) {
        return { x, y };
      }
    }
    return { x: margin, y: margin };
  }
}

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

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
