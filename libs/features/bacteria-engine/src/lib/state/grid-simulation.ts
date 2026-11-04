import type { ActiveEffect, EvolvedTraits } from './evolution';
import { weaponOf } from './evolution';
import { toughnessOf, WEAPON_CODE, WeaponEffects } from './weapon-effects';
import { mapZones, stampZones, WALL_BIT, ZONE_SHIFT } from './zones';
import {
  attackOf,
  ColonySpawn,
  colonyIntent,
  divideChanceOf,
  maxSteps,
  noEvents,
  Nutrient,
  paceSteps,
  StepEvents,
} from './bacteria-simulation';
import { colonyCapacity, GameBalance, PLAIN_TRAITS } from './game-balance';
import { CellBounds, clamp, Point } from './geometry';
import { compareDynamicWalls, DynamicWall, GameMap, stampRect } from './maps';
import { getMap } from './game-maps';
import { NutrientPellets } from './nutrient-pellets';
import { createBacteriaBlob, isBoosted, Player } from './player.model';
import {
  BlockCounts,
  ColonyLayer,
  ColonySummary,
  Ruleset,
  Simulation,
} from './simulation';
import {
  ENERGY_SCALE,
  MAX_EFFECTS,
  MAX_GPU_COLONIES,
  MAX_PELLETS,
} from './grid-format';
import {
  nearestEnemyBlock,
  Report,
  ReportLayout,
  reportLayout,
} from './simulation-report';
import {
  createIntFrameUniforms,
  IntFrameUniforms,
} from './gpu-int/int-frame-uniforms';
import {
  createIntEffectUniforms,
  IntEffectUniforms,
  setIntEffect,
} from './gpu-int/int-effects';
import {
  DETERMINISTIC_REPORT_LAG,
  divideBudgetOf,
} from './gpu-int/int-readback';

/**
 * The most cells a colony travels in one frame - each one is a claim and an
 * apply pass. Enough for a boosted colony at 30 frames a second; on a device
 * slower than that the colonies slow down instead of every frame taking
 * longer than the last.
 */
export const MAX_MOVE_STEPS = 12;

/** Read backs in flight at once - the GPU is a step or two behind. */
export const READBACK_SLOTS = 3;

/** The uniform arrays of a frame, filled in place. */
export interface FrameUniforms {
  steps: Int32Array;
  targets: Float32Array;
  aggression: Float32Array;
  attack: Float32Array;
  divideChance: Float32Array;
  divideBudget: Float32Array;
  pellets: Float32Array;
  toughness: Float32Array;
  /**
   * Per effect: its centre, its radius squared and 1 for a hostile one -
   * acting on every colony but its owner's - else 0.
   */
  effects: Float32Array;
  /** Per effect: the weapon's code and the owner's slot + 1. */
  effectKinds: Int32Array;
}

/** How a grid simulation runs - see `GpuSimulationOptions`. */
export interface GridSimulationOptions {
  /** Runs the war as the integer passes of ADR 0015. */
  deterministic?: boolean;
  /** The match's seed - see `MatchPlan.seed`. */
  matchSeed?: number;
}

/**
 * The colony war on the arena grid, as far as it is run on the CPU: the
 * walls, the zones, the pellets and the weapons' effects, the uniforms each
 * tick hands the cell passes, and what the CPU makes of a report. The cell
 * passes and the report themselves are the subclass's - `GpuSimulation`
 * runs them as WebGL2 shaders, `IntSimulation` (ADR 0015's CPU fallback)
 * as their TypeScript reference - so both read the same inputs.
 */
export abstract class GridSimulation implements Simulation {
  public abstract readonly kind: 'gpu' | 'int';
  protected width = 0;
  protected height = 0;
  protected layout: ReportLayout;
  protected map: GameMap = getMap('corridors');
  protected elapsedSec = 0;
  /** Steps run in this match. */
  protected steps = 0;
  protected spawns: ColonySpawn[] = [];
  protected dynamicWalls: DynamicWall[] = [];
  protected mask = new Uint8Array(0);
  protected staticMask = new Uint8Array(0);
  protected maskDirty = true;
  /** True on a map with a zone to hold, whose bacteria the report counts. */
  protected hasHill = false;
  protected escapePending = false;
  protected readonly pellets: NutrientPellets;
  /** The weapons' effects - none at all in a plain match. */
  protected readonly weaponEffects = new WeaponEffects();
  /** The part of a step each colony's flagella have made up - see `paceSteps`. */
  protected readonly paces = new Float64Array(MAX_GPU_COLONIES);
  protected events: StepEvents = noEvents();
  protected report: Report | null = null;
  /** The step the report in hand was rendered in. */
  protected reportStep = 0;
  protected colonySummaries: ColonySummary[] = [];
  /** Totals of the last report, to turn them into this frame's events. */
  protected reported = { captured: 0, lost: 0, poisoned: 0 };
  /** Seconds the pellets have not been drained for, waiting on a report. */
  protected undrainedSec = 0;
  /** The most cells each colony gets per frame, boosted - for its box. */
  protected readonly reach = new Int32Array(MAX_GPU_COLONIES).fill(
    MAX_MOVE_STEPS
  );
  protected readonly uniforms: FrameUniforms = {
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
  };
  /** The integer passes' share of the frame uniforms - see `deterministic`. */
  protected readonly intUniforms: IntFrameUniforms = createIntFrameUniforms();
  /** The integer passes' circles of the weapons' effects. */
  protected readonly intEffects: IntEffectUniforms = createIntEffectUniforms();
  protected readonly deterministic: boolean;
  public readonly ruleset: Ruleset | null;
  protected readonly matchSeed: number;

  protected constructor(
    protected readonly balance: GameBalance,
    random: () => number,
    options: GridSimulationOptions
  ) {
    this.deterministic = options.deterministic ?? false;
    this.ruleset = this.deterministic ? 'gpu-int' : null;
    this.matchSeed = options.matchSeed ?? 0;
    this.pellets = new NutrientPellets(balance, random);
    this.layout = reportLayout(0, 0, balance.influenceCellSize);
  }

  public abstract colonyLayers(
    boosts: ReadonlyMap<number, Point>
  ): ColonyLayer[];

  public abstract dispose(): void;

  public resize(width: number, height: number): void {
    if (this.width === width && this.height === height) {
      return;
    }
    this.width = width;
    this.height = height;
    this.layout = reportLayout(width, height, this.balance.influenceCellSize);
    this.allocate();
    if (this.spawns.length > 0) {
      this.init(this.spawns);
    }
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
    this.events = noEvents();
    this.report = null;
    this.reported = { captured: 0, lost: 0, poisoned: 0 };
    this.undrainedSec = 0;
    this.weaponEffects.clear();
    this.paces.fill(0);
    this.startMatch();
    this.buildMask();
    this.pellets.reset(this.width, this.height, this.isOpenCell);
    this.loadSpawns(spawns);
  }

  public step(players: Player[], deltaTimeSec: number): void {
    this.events = noEvents();
    if (!this.ready() || this.spawns.length === 0 || deltaTimeSec <= 0) {
      return;
    }
    this.elapsedSec += deltaTimeSec;
    this.steps++;
    // The deterministic simulation takes the reports due before anything of
    // the tick reads them - the pellets, the bots and the divide budget - so
    // the one in hand is exactly `DETERMINISTIC_REPORT_LAG` ticks old.
    if (this.deterministic) {
      this.collectReports();
    }
    this.advanceDynamicWalls();
    if (this.maskDirty) {
      this.loadMask();
    }
    this.tickPellets(deltaTimeSec);
    const mostSteps = this.fillFrameUniforms(
      players,
      deltaTimeSec,
      this.weaponEffects.begin()
    );
    this.runTick(mostSteps, deltaTimeSec);
    this.weaponEffects.end(deltaTimeSec);
  }

  /** True once the cell passes can run - the GPU's resources are set up. */
  protected abstract ready(): boolean;

  /** Sets up what the cell passes need for an arena of the current size. */
  protected abstract allocate(): void;

  /** Starts a match over - what the subclass keeps of the last one goes. */
  protected abstract startMatch(): void;

  /** Hands the passes the mask, after a wall moved or a match started. */
  protected abstract loadMask(): void;

  /** Makes `state` the state the next tick starts from. */
  protected abstract loadState(state: Uint16Array): void;

  /**
   * Hands this frame's uniforms - filled in place - to the passes: the
   * integer ones when `deterministic`, the float ones else.
   */
  protected abstract uploadFrame(
    deltaTimeSec: number,
    pelletCount: number,
    effectCount: number
  ): void;

  /**
   * Takes in the reports due: in a deterministic match every one
   * `DETERMINISTIC_REPORT_LAG` ticks old, at the start of a tick.
   */
  protected abstract collectReports(): void;

  /**
   * Runs the tick's cell passes and renders its report, from the uniforms
   * `uploadFrame` was handed; a match that is not deterministic takes in
   * its reports here too.
   */
  protected abstract runTick(mostSteps: number, deltaTimeSec: number): void;

  /** The state slot of a player's colony, null when it has none. */
  public slotOf(playerId: number): number | null {
    const slot = this.spawns.findIndex((spawn) => spawn.playerId === playerId);
    return slot < 0 ? null : slot;
  }

  /** Takes effect with the next `init`, which lays out walls and pellets. */
  public setMap(map: GameMap): void {
    this.map = map;
  }

  public getNutrients(): Nutrient[] {
    return this.pellets.nutrients;
  }

  public getActiveEffects(): readonly ActiveEffect[] {
    return this.weaponEffects.active;
  }

  public addEffect(effect: ActiveEffect): void {
    this.weaponEffects.add(effect);
  }

  public getDynamicWalls(): readonly DynamicWall[] {
    return this.dynamicWalls;
  }

  public getEvents(): StepEvents {
    return this.events;
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
   * The box around a colony, for the painter to scissor to. The report is a
   * few steps old, so the box is grown by how far the colony gets in them.
   */
  protected boundsOf(slot: number): CellBounds | null {
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
   * Puts the effects that act on cells this step into the uniform arrays -
   * not one that reaches the whole colony (the shield), which acts through
   * the toughness instead. Returns how many there are; more than the
   * shaders take are left out, the oldest first in.
   */
  protected fillEffectUniforms(effects: readonly ActiveEffect[]): number {
    const u = this.uniforms;
    let count = 0;
    for (const effect of effects) {
      const slot = this.slotOf(effect.owner);
      const weapon = weaponOf(effect.weapon);
      if (count >= MAX_EFFECTS || slot === null || weapon.reach === 'colony') {
        continue;
      }
      // Each mode fills only the circles its passes read.
      if (this.deterministic) {
        setIntEffect(this.intEffects, count, {
          x: effect.x,
          y: effect.y,
          radius: effect.radius,
          hostile: weapon.hostile,
          kind: WEAPON_CODE[effect.weapon],
          owner: slot + 1,
        });
      } else {
        u.effects[count * 4] = effect.x;
        u.effects[count * 4 + 1] = effect.y;
        u.effects[count * 4 + 2] = effect.radius * effect.radius;
        u.effects[count * 4 + 3] = weapon.hostile ? 1 : 0;
        u.effectKinds[count * 2] = WEAPON_CODE[effect.weapon];
        u.effectKinds[count * 2 + 1] = slot + 1;
      }
      count++;
    }
    this.intEffects.count = count;
    return count;
  }

  /** The most a bacterium of a colony may divide with - see `divideBudgetOf`. */
  protected divideBudget(slot: number, capacity: number): number {
    const count = this.colonySummaries[slot]?.count ?? 0;
    return divideBudgetOf(capacity, count, this.stepsBehind());
  }

  /**
   * How many steps the report in hand lags behind the war - at least the
   * read backs in flight. A display frame may run several steps, and the GPU
   * finishes no read back between the steps of one frame. The deterministic
   * simulation's lag is fixed.
   */
  protected stepsBehind(): number {
    if (this.deterministic) {
      return DETERMINISTIC_REPORT_LAG;
    }
    const behind = this.report == null ? 0 : this.steps - this.reportStep;
    return Math.max(READBACK_SLOTS, behind);
  }

  /** Turns a report into the scoreboard, the frame's events and the eaters. */
  protected takeReport(report: Report, generation: readonly number[]): void {
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

    const captured = report.colonies.reduce((sum, c) => sum + c.captured, 0);
    const lost = report.colonies.reduce((sum, c) => sum + c.lost, 0);
    const { poisoned } = report;
    const newCaptures = captured - this.reported.captured;
    const newLosses = lost - this.reported.lost;
    const newPoisoned = poisoned - this.reported.poisoned;
    this.events.captures += newCaptures;
    // A loss nobody captured is a bacterium a wall crushed - or one an
    // antibiotic killed, which makes no noise.
    this.events.crushed += Math.max(0, newLosses - newCaptures - newPoisoned);
    this.reported = { captured, lost, poisoned };

    // The eaters drain the pellets for all the time since the last report,
    // however many frames that was.
    const gain = this.balance.nutrientDrainPerSec * this.undrainedSec;
    this.undrainedSec = 0;
    this.pellets.nutrients.forEach((_, n) => {
      if (generation[n] !== this.pellets.generations[n]) {
        // The pellet moved since this report was taken.
        return;
      }
      const eaten = this.pellets.drain(n, report.eaters[n] ?? [], gain);
      if (eaten !== null) {
        this.events.pelletsEaten++;
        if (eaten.by !== null) {
          this.colonySummaries[eaten.by].pellets++;
        }
      }
    });
  }

  /** Counts eaten pellets' respawn delays down and brings them back. */
  protected tickPellets(deltaTimeSec: number): void {
    this.undrainedSec += deltaTimeSec;
    this.pellets.nutrients.forEach((nutrient, n) => {
      if (nutrient.amount <= 0) {
        this.pellets.tickEmpty(n, deltaTimeSec);
      }
    });
  }

  protected readonly isOpenCell = (x: number, y: number): boolean =>
    (this.mask[y * this.width + x] & WALL_BIT) === 0;

  /** Moves the gates and sliding walls on and notes what they did. */
  protected advanceDynamicWalls(): void {
    if (this.map.createDynamicWalls == null) {
      return;
    }
    const previous = this.dynamicWalls;
    this.dynamicWalls = this.map.createDynamicWalls(
      this.width,
      this.height,
      this.elapsedSec
    );
    const { changed, closed, warned } = compareDynamicWalls(
      previous,
      this.dynamicWalls
    );
    this.events.gatesClosed += closed;
    this.events.gatesWarned += warned;
    if (changed) {
      this.stampMask();
      this.escapePending = true;
    }
  }

  /** The static walls, and the moving ones as of the match time. */
  protected buildMask(): void {
    this.staticMask = new Uint8Array(this.width * this.height);
    // The zones above the wall bit - a wall covers the zone under it.
    const zones = mapZones(this.map, this.width, this.height);
    stampZones(this.staticMask, this.width, this.height, zones, ZONE_SHIFT);
    this.hasHill = zones.some(({ kind }) => kind === 'hill');
    for (const wall of this.map.createWalls(this.width, this.height)) {
      stampRect(this.staticMask, this.width, this.height, wall, WALL_BIT);
    }
    this.dynamicWalls =
      this.map.createDynamicWalls?.(this.width, this.height, this.elapsedSec) ??
      [];
    this.stampMask();
  }

  protected stampMask(): void {
    // A sliding wall changes it every few frames - a fresh copy each time
    // would keep the garbage collector busy, and its pauses show.
    if (this.mask.length !== this.staticMask.length) {
      this.mask = new Uint8Array(this.staticMask.length);
    }
    this.mask.set(this.staticMask);
    for (const wall of this.dynamicWalls) {
      if (wall.solid) {
        stampRect(this.mask, this.width, this.height, wall, WALL_BIT);
      }
    }
    this.maskDirty = true;
  }

  /** The box around a starting blob, before the first report is in. */
  protected spawnBounds(slot: number): CellBounds | null {
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

  /**
   * Fills the uniform arrays of this frame and hands them to the passes that
   * read them - see `uploadFrame`. Returns the most cells a colony travels.
   */
  protected fillFrameUniforms(
    players: Player[],
    deltaTimeSec: number,
    effects: readonly ActiveEffect[]
  ): number {
    const b = this.balance;
    const u = this.uniforms;
    if (!this.ready()) {
      return 0;
    }
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
    const effectCount = this.fillEffectUniforms(effects);

    const nutrients = this.pellets.nutrients;
    u.pellets.fill(0);
    nutrients.slice(0, MAX_PELLETS).forEach((pellet, n) => {
      u.pellets[n * 3] = pellet.x;
      u.pellets[n * 3 + 1] = pellet.y;
      u.pellets[n * 3 + 2] = pellet.amount > 0 ? 1 : 0;
    });
    const pelletCount = Math.min(nutrients.length, MAX_PELLETS);

    this.uploadFrame(deltaTimeSec, pelletCount, effectCount);
    return Math.max(0, ...u.steps);
  }

  /** Puts each player's starting blob into a fresh state, at full energy. */
  private loadSpawns(spawns: ColonySpawn[]): void {
    if (!this.ready()) {
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
    this.loadState(state);
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
