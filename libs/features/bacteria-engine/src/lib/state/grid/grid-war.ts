import { ArenaFixtures } from '../arena-fixtures';
import { escapeReach } from '../arena-size';
import type { ActiveEffect, EvolvedTraits } from '../evolution';
import { weaponOf } from '../evolution';
import { toughnessOf, WEAPON_CODE } from '../weapon-effects';
import { mapZones, stampZones, WALL_BIT, ZONE_SHIFT } from '../zones';
import {
  attackOf,
  ColonySpawn,
  colonyIntent,
  divideChanceOf,
  maxSteps,
  Nutrient,
  paceSteps,
  StepEvents,
} from '../bacteria-simulation';
import { colonyCapacity, GameBalance, PLAIN_TRAITS } from '../game-balance';
import { CellBounds, clamp, Point } from '../geometry';
import { DynamicWall, GameMap, stampRect } from '../maps';
import { createBacteriaBlob, isBoosted, Player } from '../player.model';
import {
  BlockCounts,
  ColonyLayer,
  ColonySummary,
  Ruleset,
  Simulation,
} from '../simulation';
import {
  ENERGY_SCALE,
  MAX_EFFECTS,
  MAX_GPU_COLONIES,
  MAX_PELLETS,
} from '../grid-format';
import {
  decodeReport,
  nearestEnemyBlock,
  Report,
  ReportLayout,
  reportLayout,
} from '../simulation-report';
import { createIntEffectUniforms, setIntEffect } from '../gpu-int/int-effects';
import {
  DETERMINISTIC_REPORT_LAG,
  divideBudgetOf,
} from '../gpu-int/int-readback';
import type {
  CellPasses,
  GridFrame,
  GridTick,
  ReportSink,
} from './cell-passes';

/**
 * The most cells a colony travels in one frame - each one is a claim and an
 * apply pass. Enough for a boosted colony at 30 frames a second; on a device
 * slower than that the colonies slow down instead of every frame taking
 * longer than the last.
 */
export const MAX_MOVE_STEPS = 12;

/** Read backs in flight at once - the GPU is a step or two behind. */
export const READBACK_SLOTS = 3;

/**
 * The colony war on the arena grid, as far as it is run on the CPU: the
 * walls, the zones, the pellets and the weapons' effects, the uniforms each
 * tick hands the cell passes, and what the CPU makes of a report. The cell
 * passes and the report themselves are a {@link CellPasses} adapter's - the
 * game's GPU passes, or their TypeScript reference (`IntReferencePasses`,
 * ADR 0015's CPU fallback) - so every adapter reads the same inputs.
 */
export class GridWar implements Simulation {
  public readonly kind: 'gpu' | 'int';
  /** `gpu-int` on deterministic passes; the float ones have no ruleset. */
  public readonly ruleset: Ruleset | null;
  private width = 0;
  private height = 0;
  private layout: ReportLayout;
  private elapsedSec = 0;
  /** Steps run in this match. */
  private steps = 0;
  private spawns: ColonySpawn[] = [];
  private mask = new Uint8Array(0);
  private staticMask = new Uint8Array(0);
  /** True while the passes hold an older mask than `mask`. */
  private maskDirty = true;
  /** True on a map with a zone to hold, whose bacteria the report counts. */
  private hasHill = false;
  /** True from a wall moving until the next tick's escape passes ran. */
  private escapePending = false;
  private readonly arena: ArenaFixtures;
  /** The part of a step each colony's flagella have made up - see `paceSteps`. */
  private readonly paces = new Float64Array(MAX_GPU_COLONIES);
  private report: Report | null = null;
  /** The step the report in hand was rendered in. */
  private reportStep = 0;
  private colonySummaries: ColonySummary[] = [];
  /** Totals of the last report, to turn them into this frame's events. */
  private reported = { captured: 0, lost: 0, poisoned: 0 };
  /** Seconds the pellets have not been drained for, waiting on a report. */
  private undrainedSec = 0;
  /** The most cells each colony gets per frame, boosted - for its box. */
  private readonly reach = new Int32Array(MAX_GPU_COLONIES).fill(
    MAX_MOVE_STEPS
  );
  /** This tick's frame, filled in place - see `fillFrame`. */
  private readonly frame: GridFrame = {
    deltaTimeSec: 0,
    uniforms: {
      steps: new Int32Array(MAX_GPU_COLONIES),
      targets: new Float32Array(MAX_GPU_COLONIES * 2),
      aggression: new Float32Array(MAX_GPU_COLONIES),
      attack: new Float32Array(MAX_GPU_COLONIES),
      divideChance: new Float32Array(MAX_GPU_COLONIES),
      divideBudget: new Float32Array(MAX_GPU_COLONIES),
      pellets: new Float32Array(MAX_PELLETS * 3),
      toughness: new Float32Array(MAX_GPU_COLONIES),
      effects: new Float32Array(MAX_EFFECTS * 4),
      effectKinds: new Int32Array(MAX_EFFECTS * 2),
    },
    intEffects: createIntEffectUniforms(),
    pelletCount: 0,
    effectCount: 0,
  };
  /** This tick's inputs of the passes, filled in place - see `step`. */
  private readonly tick: GridTick = {
    step: 0,
    mostSteps: 0,
    deltaTimeSec: 0,
    escapeSteps: 0,
    colonies: 0,
    report: null,
    reportStep: 0,
    generation: [],
  };
  /** Where the passes hand their reports - see `takeReport`. */
  private readonly sink: ReportSink = {
    take: (data, step, generation) => {
      this.reportStep = step;
      this.takeReport(
        decodeReport(data, this.layout, this.spawns.length),
        generation
      );
    },
  };

  public constructor(
    private readonly passes: CellPasses,
    private readonly balance: GameBalance,
    random: () => number
  ) {
    this.kind = passes.kind;
    this.ruleset = passes.deterministic ? 'gpu-int' : null;
    this.arena = new ArenaFixtures(balance, random);
    this.layout = reportLayout(0, 0, balance.influenceCellSize);
    passes.attach({ restart: () => this.restart() });
  }

  public resize(width: number, height: number): void {
    if (this.width === width && this.height === height) {
      return;
    }
    this.width = width;
    this.height = height;
    this.layout = reportLayout(width, height, this.balance.influenceCellSize);
    this.passes.allocate({ width, height, layout: this.layout });
    this.restart();
  }

  public init(spawns: ColonySpawn[]): void {
    if (spawns.length > MAX_GPU_COLONIES) {
      throw new Error(
        `The grid simulation runs ${MAX_GPU_COLONIES} colonies, not ${spawns.length}`
      );
    }
    this.spawns = spawns;
    this.elapsedSec = 0;
    this.steps = 0;
    this.arena.resetEvents();
    this.report = null;
    this.reported = { captured: 0, lost: 0, poisoned: 0 };
    this.undrainedSec = 0;
    this.arena.weaponEffects.clear();
    this.paces.fill(0);
    this.passes.startMatch();
    this.buildMask();
    this.arena.pellets.reset(this.width, this.height, this.isOpenCell);
    this.loadSpawns(spawns);
  }

  public step(players: Player[], deltaTimeSec: number): void {
    this.arena.resetEvents();
    if (!this.passes.ready() || this.spawns.length === 0 || deltaTimeSec <= 0) {
      return;
    }
    this.elapsedSec += deltaTimeSec;
    this.steps++;
    if (this.passes.deterministic) {
      this.takeDueReports();
    }
    this.advanceDynamicWalls();
    if (this.maskDirty) {
      this.passes.loadMask(this.mask, this.hasHill);
      this.maskDirty = false;
    }
    this.tickPellets(deltaTimeSec);
    const effects = this.arena.weaponEffects.begin();
    this.passes.uploadFrame(this.fillFrame(players, deltaTimeSec, effects));
    this.passes.runTick(this.fillTick(deltaTimeSec), this.sink);
    this.escapePending = false;
    this.arena.weaponEffects.end(deltaTimeSec);
  }

  public colonyLayers(boosts: ReadonlyMap<number, Point>): ColonyLayer[] {
    return this.passes.colonyLayers(this.spawns, boosts, (slot) =>
      this.boundsOf(slot)
    );
  }

  /**
   * The cell state after the last tick - for the self-test and the
   * cross-check, never during a match: on the GPU it waits for the GPU.
   * Null before the passes are set up.
   */
  public readState(): Uint16Array | null {
    return this.passes.readState();
  }

  public takeGpuWaitMs(): number {
    return this.passes.takeGpuWaitMs?.() ?? 0;
  }

  public dispose(): void {
    this.passes.dispose();
  }

  /** The state slot of a player's colony, null when it has none. */
  public slotOf(playerId: number): number | null {
    const slot = this.spawns.findIndex((spawn) => spawn.playerId === playerId);
    return slot < 0 ? null : slot;
  }

  /** Takes effect with the next `init`, which lays out walls and pellets. */
  public setMap(map: GameMap): void {
    this.arena.setMap(map);
  }

  public getNutrients(): Nutrient[] {
    return this.arena.getNutrients();
  }

  public getActiveEffects(): readonly ActiveEffect[] {
    return this.arena.getActiveEffects();
  }

  public addEffect(effect: ActiveEffect): void {
    this.arena.addEffect(effect);
  }

  public getDynamicWalls(): readonly DynamicWall[] {
    return this.arena.dynamicWalls;
  }

  public getEvents(): StepEvents {
    return this.arena.events;
  }

  public summaries(): readonly ColonySummary[] {
    return this.colonySummaries;
  }

  /** The block counts of the last report read back - a frame late. */
  public blockCounts(): BlockCounts | null {
    if (this.report == null) {
      return null;
    }
    const { blocksX, blocksY, cellSize } = this.layout;
    return {
      blocksX,
      blocksY,
      cellSize,
      counts: this.report.blockCounts,
    };
  }

  public nearestEnemy(playerId: number, from: Point): Point | null {
    const slot = this.slotOf(playerId);
    if (this.report == null || slot == null) {
      return null;
    }
    return nearestEnemyBlock(this.report, this.layout, slot, from);
  }

  /**
   * After the passes were set up afresh: they hold no mask, and a match
   * under way starts over.
   */
  private restart(): void {
    this.maskDirty = true;
    if (this.spawns.length > 0) {
      this.init(this.spawns);
    }
  }

  /**
   * The deterministic war takes the reports due before anything of the
   * tick reads them - the pellets, the bots and the divide budget - so the
   * one in hand is exactly `DETERMINISTIC_REPORT_LAG` ticks old.
   */
  private takeDueReports(): void {
    this.passes.collectReports(this.steps, this.sink);
  }

  /** What this tick's passes read of the war besides the frame. */
  private fillTick(deltaTimeSec: number): GridTick {
    const tick = this.tick;
    tick.step = this.steps;
    tick.mostSteps = Math.max(0, ...this.frame.uniforms.steps);
    tick.deltaTimeSec = deltaTimeSec;
    tick.escapeSteps = this.escapePending
      ? escapeReach(this.width, this.arena.map.size)
      : 0;
    tick.colonies = this.spawns.length;
    tick.report = this.report;
    tick.reportStep = this.reportStep;
    tick.generation = this.arena.pellets.generations;
    return tick;
  }

  /**
   * The box around a colony, for the painter to scissor to. The report is a
   * few steps old, so the box is grown by how far the colony gets in them.
   */
  private boundsOf(slot: number): CellBounds | null {
    const bounds =
      this.report == null
        ? this.spawnBounds(slot)
        : (this.report.colonies[slot]?.bounds ?? null);
    if (bounds == null) {
      return null;
    }
    const margin = this.reach[slot] * this.stepsBehind();
    return {
      minX: clamp(bounds.minX - margin, 0, this.width - 1),
      minY: clamp(bounds.minY - margin, 0, this.height - 1),
      maxX: clamp(bounds.maxX + margin, 0, this.width - 1),
      maxY: clamp(bounds.maxY + margin, 0, this.height - 1),
    };
  }

  /**
   * Puts the effects that act on cells this step into the frame - as
   * circles for the float passes and for the integer ones; each reads only
   * its own. Not one that reaches the whole colony (the shield), which acts
   * through the toughness instead. Returns how many there are; more than
   * the passes take are left out, the oldest first in.
   */
  private fillEffects(effects: readonly ActiveEffect[]): number {
    const u = this.frame.uniforms;
    const intEffects = this.frame.intEffects;
    let count = 0;
    for (const effect of effects) {
      const slot = this.slotOf(effect.owner);
      const weapon = weaponOf(effect.weapon);
      if (count >= MAX_EFFECTS || slot === null || weapon.reach === 'colony') {
        continue;
      }
      setIntEffect(intEffects, count, {
        x: effect.x,
        y: effect.y,
        radius: effect.radius,
        hostile: weapon.hostile,
        kind: WEAPON_CODE[effect.weapon],
        owner: slot + 1,
      });
      u.effects[count * 4] = effect.x;
      u.effects[count * 4 + 1] = effect.y;
      u.effects[count * 4 + 2] = effect.radius * effect.radius;
      u.effects[count * 4 + 3] = weapon.hostile ? 1 : 0;
      u.effectKinds[count * 2] = WEAPON_CODE[effect.weapon];
      u.effectKinds[count * 2 + 1] = slot + 1;
      count++;
    }
    intEffects.count = count;
    return count;
  }

  /** The most a bacterium of a colony may divide with - see `divideBudgetOf`. */
  private divideBudget(slot: number, capacity: number): number {
    const count = this.colonySummaries[slot]?.count ?? 0;
    return divideBudgetOf(capacity, count, this.stepsBehind());
  }

  /**
   * How many steps the report in hand lags behind the war - at least the
   * read backs in flight. A display frame may run several steps, and the GPU
   * finishes no read back between the steps of one frame. The deterministic
   * war's lag is fixed.
   */
  private stepsBehind(): number {
    if (this.passes.deterministic) {
      return DETERMINISTIC_REPORT_LAG;
    }
    const behind = this.report == null ? 0 : this.steps - this.reportStep;
    return Math.max(READBACK_SLOTS, behind);
  }

  /** Turns a report into the scoreboard, the frame's events and the eaters. */
  private takeReport(report: Report, generation: readonly number[]): void {
    this.report = report;
    const before = this.colonySummaries;
    this.colonySummaries = this.spawns.map((spawn, index) => {
      const colony = report.colonies[index];
      return {
        playerId: spawn.playerId,
        color: spawn.color,
        count: colony.count,
        captured: colony.captured,
        lost: colony.lost,
        totalEnergy: colony.totalEnergy,
        center: colony.center,
        onHill: colony.onHill,
        // Counted here, as the pellets are drained - carried on.
        pellets: before[index]?.pellets ?? 0,
      };
    });

    const events = this.arena.events;
    const captured = report.colonies.reduce((sum, c) => sum + c.captured, 0);
    const lost = report.colonies.reduce((sum, c) => sum + c.lost, 0);
    const { poisoned } = report;
    const newCaptures = captured - this.reported.captured;
    const newLosses = lost - this.reported.lost;
    const newPoisoned = poisoned - this.reported.poisoned;
    events.captures += newCaptures;
    // A loss nobody captured is a bacterium a wall crushed - or one an
    // antibiotic killed, which makes no noise.
    events.crushed += Math.max(0, newLosses - newCaptures - newPoisoned);
    this.reported = { captured, lost, poisoned };

    // The eaters drain the pellets for all the time since the last report,
    // however many frames that was.
    const pellets = this.arena.pellets;
    const gain = this.balance.nutrientDrainPerSec * this.undrainedSec;
    this.undrainedSec = 0;
    pellets.nutrients.forEach((_, n) => {
      if (generation[n] !== pellets.generations[n]) {
        // The pellet moved since this report was taken.
        return;
      }
      const eaten = pellets.drain(n, report.eaters[n] ?? [], gain);
      if (eaten !== null) {
        events.pelletsEaten++;
        if (eaten.by !== null) {
          this.colonySummaries[eaten.by].pellets++;
        }
      }
    });
  }

  /** Counts eaten pellets' respawn delays down and brings them back. */
  private tickPellets(deltaTimeSec: number): void {
    const pellets = this.arena.pellets;
    this.undrainedSec += deltaTimeSec;
    pellets.nutrients.forEach((nutrient, n) => {
      if (nutrient.amount <= 0) {
        pellets.tickEmpty(n, deltaTimeSec);
      }
    });
  }

  private readonly isOpenCell = (x: number, y: number): boolean =>
    (this.mask[y * this.width + x] & WALL_BIT) === 0;

  /** Moves the gates and sliding walls on; the next passes escape them. */
  private advanceDynamicWalls(): void {
    if (this.arena.advanceWalls(this.width, this.height, this.elapsedSec)) {
      this.stampMask();
      this.escapePending = true;
    }
  }

  /** The static walls, and the moving ones as of the match time. */
  private buildMask(): void {
    const map = this.arena.map;
    this.staticMask = new Uint8Array(this.width * this.height);
    // The zones above the wall bit - a wall covers the zone under it.
    const zones = mapZones(map, this.width, this.height);
    stampZones(this.staticMask, this.width, this.height, zones, ZONE_SHIFT);
    this.hasHill = zones.some(({ kind }) => kind === 'hill');
    for (const wall of map.createWalls(this.width, this.height)) {
      stampRect(this.staticMask, this.width, this.height, wall, WALL_BIT);
    }
    this.arena.startWalls(this.width, this.height, this.elapsedSec);
    this.stampMask();
  }

  private stampMask(): void {
    // A sliding wall changes it every few frames - a fresh copy each time
    // would keep the garbage collector busy, and its pauses show.
    if (this.mask.length !== this.staticMask.length) {
      this.mask = new Uint8Array(this.staticMask.length);
    }
    this.mask.set(this.staticMask);
    for (const wall of this.arena.dynamicWalls) {
      if (wall.solid) {
        stampRect(this.mask, this.width, this.height, wall, WALL_BIT);
      }
    }
    this.maskDirty = true;
  }

  /** The box around a starting blob, before the first report is in. */
  private spawnBounds(slot: number): CellBounds | null {
    const spawn = this.spawns[slot];
    if (spawn == null) {
      return null;
    }
    const r = spawn.radius + 1;
    return {
      minX: clamp(Math.floor(spawn.x - r), 0, this.width - 1),
      minY: clamp(Math.floor(spawn.y - r), 0, this.height - 1),
      maxX: clamp(Math.ceil(spawn.x + r), 0, this.width - 1),
      maxY: clamp(Math.ceil(spawn.y + r), 0, this.height - 1),
    };
  }

  /** Fills this tick's frame in place - see `GridFrame`. */
  private fillFrame(
    players: Player[],
    deltaTimeSec: number,
    effects: readonly ActiveEffect[]
  ): GridFrame {
    const b = this.balance;
    const frame = this.frame;
    const u = frame.uniforms;
    const capacity = colonyCapacity(b, this.spawns.length);
    u.steps.fill(0);
    u.targets.fill(NaN);
    this.spawns.forEach((spawn, slot) => {
      const traits: EvolvedTraits = spawn.traits ?? PLAIN_TRAITS;
      u.divideChance[slot] = divideChanceOf(b, traits, deltaTimeSec);
      const target = players.find((player) => player.id === spawn.playerId);
      const intent = colonyIntent(target, b, deltaTimeSec, traits);
      u.aggression[slot] = intent?.aggression ?? b.aggression;
      u.attack[slot] = attackOf(b, traits, isBoosted(target ?? null));
      u.toughness[slot] = toughnessOf(traits, effects, spawn.playerId);
      u.divideBudget[slot] = this.divideBudget(slot, capacity);
      if (target == null || intent == null) {
        return;
      }
      u.steps[slot] = Math.min(
        MAX_MOVE_STEPS,
        paceSteps(intent, this.paces, slot)
      );
      u.targets[slot * 2] = target.x;
      u.targets[slot * 2 + 1] = target.y;
      this.reach[slot] = Math.min(
        MAX_MOVE_STEPS,
        maxSteps(target, b, deltaTimeSec, traits)
      );
    });
    frame.effectCount = this.fillEffects(effects);

    const nutrients = this.arena.pellets.nutrients;
    u.pellets.fill(0);
    nutrients.slice(0, MAX_PELLETS).forEach((pellet, n) => {
      u.pellets[n * 3] = pellet.x;
      u.pellets[n * 3 + 1] = pellet.y;
      u.pellets[n * 3 + 2] = pellet.amount > 0 ? 1 : 0;
    });
    frame.pelletCount = Math.min(nutrients.length, MAX_PELLETS);
    frame.deltaTimeSec = deltaTimeSec;
    return frame;
  }

  /** Puts each player's starting blob into a fresh state, at full energy. */
  private loadSpawns(spawns: ColonySpawn[]): void {
    if (!this.passes.ready()) {
      return;
    }
    const state = new Uint16Array(this.width * this.height * 4);
    const energy = Math.round(this.balance.maxEnergy * ENERGY_SCALE);
    const counts = spawns.map(() => 0);
    spawns.forEach((spawn, slot) => {
      for (const { x, y } of createBacteriaBlob(
        spawn.x,
        spawn.y,
        spawn.radius
      )) {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
          continue;
        }
        const index = (y * this.width + x) * 4;
        if (state[index] !== 0) {
          continue;
        }
        state[index] = slot + 1;
        state[index + 1] = energy;
        counts[slot]++;
      }
    });
    this.passes.loadState(state);
    this.colonySummaries = spawns.map((spawn, slot) => ({
      playerId: spawn.playerId,
      color: spawn.color,
      count: counts[slot],
      captured: 0,
      lost: 0,
      totalEnergy: counts[slot] * this.balance.maxEnergy,
      center: counts[slot] > 0 ? { x: spawn.x, y: spawn.y } : null,
      // Counted from the first report on - the ticks before it are credited
      // to whoever holds the zone then.
      onHill: 0,
      pellets: 0,
    }));
  }
}
