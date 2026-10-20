import {
  addEvents,
  BacteriaSimulation,
  noEvents,
  StepEvents,
} from './bacteria-simulation';
import { ColonySummary, Simulation, SimulationFactory } from './simulation';
import {
  BotController,
  BotDifficulty,
  buildBotView,
  DEFAULT_DIFFICULTY,
} from './bot-controller';
import { countDown, TICK_SEC, TICKS_PER_SEC } from './fixed-tick';
import { GameBalance, gameBalance } from './game-balance';
import {
  clamp,
  clampLength,
  isSteering,
  Point,
  seeded,
  SteeringVector,
  streamSeed,
} from './geometry';
import { DEFAULT_CROSSHAIR_SPEED } from './levels';
import { getMap } from './game-maps';
import { GameMap } from './maps';
import {
  createPlayer,
  isBoostReady,
  Player,
  PlayerColorArray,
} from './player.model';
import type { GhostController } from './ghost';
import type { ReplayInputs } from './replay';
import {
  ANNIHILATION,
  judgeOutcome,
  MatchOutcome,
  WinRule,
} from './win-conditions';

/** What a match needs to know about one player before it starts. */
export interface PlayerSpawn {
  x: number;
  y: number;
  color: PlayerColorArray;
  name: string;
  /** True when the computer steers this crosshair. */
  isBot: boolean;
  /** The colony's start area as a share of the level's - 1 when absent. */
  startScale?: number;
}

/** The simulation on the CPU - the reference. */
export const cpuSimulation: SimulationFactory = (balance, random) =>
  new BacteriaSimulation(balance, random);

/** How a match is played - everything but who plays it. */
export interface MatchOptions {
  balance?: GameBalance;
  map?: GameMap;
  crosshairSpeed?: number;
  difficulty?: BotDifficulty;
  /**
   * The arena size, when it is known. The walls are only laid out once the
   * simulation has a size, and the start screen shows the gates and sliding
   * walls of the next match as well.
   */
  arena?: { width: number; height: number };
  /** Where every chance of the match comes from. */
  seed: number;
  /** Builds the simulation - the CPU one when absent. */
  simulation?: SimulationFactory;
  /**
   * The players driven by a recording, by seat - all the humans when a
   * replay is played again, the opponent in a ghost match. What is set from
   * outside for them is ignored, and no bot steers them, even where the seat
   * spawns as one - as the ghost does, so the game treats it as nobody at
   * the screen.
   */
  ghosts?: ReadonlyMap<number, GhostController>;
  /** How the match is won - by annihilation when absent. */
  win?: WinRule;
}

/** A frame in which nothing happened. */
export function noFrameEvents(): FrameEvents {
  return { ...noEvents(), boosts: [] };
}

/** What happened during a frame - the simulation's events and the boosts. */
export interface FrameEvents extends StepEvents {
  /** One entry per boost fired since the frame before, true for the computer's. */
  boosts: boolean[];
}

/** How a match ended, from the point of view of the people at the screen. */
export type MatchResult = 'win' | 'loss' | 'draw';

/**
 * The grid the humans' inputs are kept on: a stick push in steps of 1/16,
 * a drag target in quarter cells. What is played is what is recorded, and a
 * recording - a link to a ghost in particular - stays small.
 */
export const STEER_STEPS = 16;
export const DRAG_STEPS = 4;

function onGrid(value: number, steps: number): number {
  // `|| 0` turns a rounded -0 into 0, as it comes back from a link.
  return Math.round(value * steps) / steps || 0;
}

/** A crosshair nobody steers. */
const AT_REST: SteeringVector = Object.freeze({ x: 0, y: 0 });

/**
 * One match, tick by tick: the players' crosshairs and scores, the bots and
 * the simulation. It knows nothing of Angular, the stores or the keyboard,
 * so a recorded match can be played again anywhere - in the browser for a
 * ghost, in Node to verify a time.
 *
 * The humans steer through what they put in - a steering vector, a drag
 * target, a boost - and the engine records those inputs as they change: the
 * crosshairs follow from them, so the recording stays small.
 *
 * The players are replaced, never changed in place, so an array handed out
 * stays as it was.
 */
export class MatchEngine {
  public readonly seed: number;
  public readonly balance: GameBalance;
  public readonly simulation: Simulation;
  private playerList: Player[];
  /** True while `playerList` is this tick's own copy, free to change. */
  private ownsPlayers = false;
  /** The computer opponents, one per bot player. */
  private readonly bots = new Map<number, BotController>();
  /** Arena position a player is currently dragging their crosshair towards. */
  private readonly dragTargets = new Map<number, Point>();
  /** Where each player's stick and keys push, absent while at rest. */
  private readonly steering = new Map<number, SteeringVector>();
  /** Drag targets a human set since the last tick, to record. */
  private readonly newDrags = new Map<number, Point>();
  /** The steering last recorded per human. */
  private readonly recordedSteering = new Map<number, SteeringVector>();
  /** Where each crosshair stood before the last tick, for drawing between ticks. */
  private readonly lastCrosshairs = new Map<number, Point>();
  /** Boosts fired since the last frame - true for the computer's. */
  private firedBoosts: boolean[] = [];
  /** What the ticks of the frame under way did so far. */
  private tickEvents: StepEvents = noEvents();
  private ticks = 0;
  /** What the humans at the screen put in, for the replay. */
  private readonly inputs: ReplayInputs = { steers: [], drags: [], boosts: [] };
  /** The players a recording drives, by seat. */
  private readonly ghosts: ReadonlyMap<number, GhostController>;
  private readonly win: WinRule;

  public constructor(spawns: readonly PlayerSpawn[], options: MatchOptions) {
    this.seed = options.seed;
    this.balance = options.balance ?? gameBalance;
    this.ghosts = options.ghosts ?? new Map();
    this.win = options.win ?? ANNIHILATION;
    this.playerList = spawns.map((spawn, index) => {
      if (spawn.isBot && !this.ghosts.has(index)) {
        this.bots.set(
          index,
          new BotController(
            options.difficulty ?? DEFAULT_DIFFICULTY,
            seeded(streamSeed(this.seed, index + 1))
          )
        );
      }
      return createPlayer({
        id: index,
        x: spawn.x,
        y: spawn.y,
        color: spawn.color,
        name: spawn.name,
        isBot: spawn.isBot,
        maxSpeed: options.crosshairSpeed ?? DEFAULT_CROSSHAIR_SPEED,
      });
    });

    this.simulation = (options.simulation ?? cpuSimulation)(
      this.balance,
      seeded(this.seed)
    );
    if (options.arena != null) {
      this.simulation.resize(options.arena.width, options.arena.height);
    }
    this.simulation.setMap(options.map ?? getMap('corridors'));
    const radius = this.balance.startBacteriaRadius;
    this.simulation.init(
      spawns.map((spawn, index) => ({
        playerId: index,
        color: spawn.color,
        x: spawn.x,
        y: spawn.y,
        // The scale is one of area: the radius shrinks by its root.
        radius: Math.max(1, radius * Math.sqrt(spawn.startScale ?? 1)),
      }))
    );
    this.syncColonyStats();
    this.ownsPlayers = false;
  }

  /** The players as they stand after the last tick. */
  public get players(): readonly Player[] {
    return this.playerList;
  }

  /** Ticks played so far. */
  public get tickCount(): number {
    return this.ticks;
  }

  /** What the humans put in so far - a match's worth once it is over. */
  public get recorded(): ReplayInputs {
    return this.inputs;
  }

  /**
   * Steers a crosshair towards an arena position, for pointer and touch input.
   *
   * The crosshair travels there at `maxSpeed` instead of jumping, so dragging
   * is no faster than the keyboard and the two input methods stay comparable.
   *
   * The target outlives the gesture, so a tap sends the crosshair across the
   * arena instead of nudging it for a single tick. It is dropped once the
   * crosshair arrives, or as soon as the player steers.
   */
  public setDragTarget(playerId: number, x: number, y: number): void {
    if (!this.isLive(playerId)) {
      return;
    }
    const target = { x: onGrid(x, DRAG_STEPS), y: onGrid(y, DRAG_STEPS) };
    this.dragTargets.set(playerId, target);
    this.newDrags.set(playerId, target);
  }

  /**
   * Pushes a player's crosshair in a direction - the keys and the joystick
   * together. It keeps moving at up to `maxSpeed` that way, slower for a
   * gentle push, until the zero vector releases it, and it wins over a drag
   * target.
   */
  public setSteering(playerId: number, vector: SteeringVector): void {
    if (!this.isLive(playerId)) {
      return;
    }
    this.steer(playerId, {
      x: onGrid(vector.x, STEER_STEPS),
      y: onGrid(vector.y, STEER_STEPS),
    });
  }

  /**
   * Fires a player's boost. Nothing happens while one is running or the
   * previous one is still recharging, so hammering the key does not help.
   * Returns whether it fired.
   */
  public boost(playerId: number): boolean {
    if (this.ghosts.has(playerId)) {
      return false;
    }
    return this.fireBoost(playerId);
  }

  /** True for a human at the screen - neither a bot nor a ghost. */
  public isLive(playerId: number): boolean {
    return !this.bots.has(playerId) && !this.ghosts.has(playerId);
  }

  /**
   * Advances the match by one tick of {@link TICK_SEC}: the crosshairs, the
   * boosts, the bots and the war.
   */
  public tick(width: number, height: number): void {
    for (const player of this.playerList) {
      this.lastCrosshairs.set(player.id, player);
    }
    this.playGhosts();
    this.record();
    for (const player of this.playerList) {
      this.movePlayer(player.id, width, height);
    }
    this.simulation.resize(width, height);
    this.tickBoosts();
    this.runBots(width, height);
    this.simulation.step(this.playerList, TICK_SEC);
    this.tickEvents = addEvents(this.tickEvents, this.simulation.getEvents());
    this.syncColonyStats();
    this.ownsPlayers = false;
    this.ticks++;
  }

  /**
   * Closes a display frame: what its ticks did, and the boosts fired since
   * the last one, become the frame's events.
   */
  public takeFrameEvents(): FrameEvents {
    const events = { ...this.tickEvents, boosts: this.firedBoosts };
    this.tickEvents = noEvents();
    this.firedBoosts = [];
    return events;
  }

  /**
   * Where a crosshair is drawn: `alpha` of its last step further on, so it
   * glides on a display whose frames fall between the ticks - and is not
   * drawn a tick behind on one whose frames do not.
   */
  public crosshairAt(
    player: Player,
    alpha: number,
    width: number,
    height: number
  ): Point {
    const from = this.lastCrosshairs.get(player.id) ?? player;
    return {
      x: clamp(player.x + (player.x - from.x) * alpha, 0, width),
      y: clamp(player.y + (player.y - from.y) * alpha, 0, height),
    };
  }

  /** How the match ended, null while it is still on. */
  public outcome(): MatchOutcome | null {
    return judgeOutcome(this.win, this.playerList, this.ticks / TICKS_PER_SEC);
  }

  public dispose(): void {
    this.simulation.dispose();
  }

  /**
   * Changes one player. The first change of a tick copies the list, the
   * others change that copy - the list handed out before stays as it was.
   */
  private update(playerId: number, change: Partial<Player>): void {
    if (!this.ownsPlayers) {
      this.playerList = this.playerList.slice();
      this.ownsPlayers = true;
    }
    this.playerList[playerId] = { ...this.playerList[playerId], ...change };
  }

  private steer(playerId: number, vector: SteeringVector): void {
    if (isSteering(vector)) {
      this.steering.set(playerId, vector);
    } else {
      this.steering.delete(playerId);
    }
  }

  private fireBoost(playerId: number): boolean {
    const player = this.playerList[playerId];
    if (player == null || !isBoostReady(player)) {
      return false;
    }
    this.update(playerId, {
      boostActiveSec: this.balance.boostDurationSec,
      boostCooldownSec: this.balance.boostCooldownSec,
      boostsFired: player.boostsFired + 1,
    });
    this.ownsPlayers = false;
    this.firedBoosts.push(player.isBot);
    if (this.isLive(playerId)) {
      // Fired between two ticks, it counts from the next one on.
      this.inputs.boosts.push([this.ticks, playerId]);
    }
    return true;
  }

  /** Records what the humans changed since the last tick. */
  private record(): void {
    for (const [playerId, { x, y }] of this.newDrags) {
      this.inputs.drags.push([this.ticks, playerId, x, y]);
    }
    this.newDrags.clear();
    for (const player of this.playerList) {
      if (!this.isLive(player.id)) {
        continue;
      }
      const now = this.steering.get(player.id) ?? AT_REST;
      const last = this.recordedSteering.get(player.id) ?? AT_REST;
      if (now.x !== last.x || now.y !== last.y) {
        this.inputs.steers.push([this.ticks, player.id, now.x, now.y]);
        this.recordedSteering.set(player.id, now);
      }
    }
  }

  /** Puts in what the recordings have the ghosts put in before this tick. */
  private playGhosts(): void {
    for (const [playerId, ghost] of this.ghosts) {
      const { boost, drag, steer } = ghost.before(this.ticks);
      if (boost) {
        this.fireBoost(playerId);
      }
      if (drag != null) {
        this.dragTargets.set(playerId, drag);
      }
      if (steer != null) {
        this.steer(playerId, steer);
      }
    }
  }

  /**
   * Moves one crosshair, kept inside the arena.
   *
   * The direction is capped at unit length, so a diagonal - two keys at once,
   * or a stick pulled to the rim - is no faster than a straight line. A held
   * key or a pushed stick wins over a drag target - it drops the target, so a
   * stale one cannot keep pulling the crosshair back.
   */
  private movePlayer(playerId: number, width: number, height: number): void {
    const direction = this.steering.get(playerId);
    if (direction != null) {
      this.dragTargets.delete(playerId);
    }
    const target = this.dragTargets.get(playerId);
    if (target == null && direction == null) {
      return;
    }
    const player = this.playerList[playerId];
    const step = player.maxSpeed * TICK_SEC;
    let next: Point;
    if (direction != null) {
      const { x: xDir, y: yDir } = clampLength(direction, 1);
      next = {
        x: clamp(player.x + xDir * step, 0, width),
        y: clamp(player.y + yDir * step, 0, height),
      };
    } else if (target != null) {
      const dX = target.x - player.x;
      const dY = target.y - player.y;
      const distance = Math.hypot(dX, dY);
      if (distance <= step) {
        this.dragTargets.delete(playerId);
        next = target;
      } else {
        next = {
          x: player.x + (dX / distance) * step,
          y: player.y + (dY / distance) * step,
        };
      }
    } else {
      return;
    }
    // Real input stays inside the arena anyway; a crafted link may not.
    next = { x: clamp(next.x, 0, width), y: clamp(next.y, 0, height) };
    if (next.x !== player.x || next.y !== player.y) {
      this.update(playerId, { x: next.x, y: next.y });
    }
  }

  /**
   * Counts the boost timers down. The boost runs out first, only then does
   * the recharge start - so a player waits the full cooldown after a boost.
   */
  private tickBoosts(): void {
    for (const player of this.playerList) {
      if (player.boostActiveSec > 0) {
        this.update(player.id, {
          boostActiveSec: countDown(player.boostActiveSec),
        });
      } else if (player.boostCooldownSec > 0) {
        this.update(player.id, {
          boostCooldownSec: countDown(player.boostCooldownSec),
        });
      }
    }
  }

  /** Lets every computer opponent look at the arena and steer its crosshair. */
  private runBots(width: number, height: number): void {
    if (this.bots.size === 0) {
      return;
    }
    const colonies = this.simulation.summaries();
    for (const [playerId, bot] of this.bots) {
      const player = this.playerList[playerId];
      const own = colonies.find((colony) => colony.playerId === playerId);
      if (player == null || own == null) {
        continue;
      }
      const view = buildBotView(
        width,
        height,
        own,
        colonies,
        (from) => this.simulation.nearestEnemy(playerId, from),
        this.simulation.getNutrients(),
        isBoostReady(player),
        this.balance.maxEnergy
      );
      const decision = bot.decide(view, TICK_SEC);
      if (decision.target != null) {
        this.dragTargets.set(playerId, decision.target);
      }
      if (decision.boost) {
        this.fireBoost(playerId);
      }
    }
  }

  /**
   * Takes the colony scoreboard over into the players - with the peak and
   * the lowest size ratio the match is judged on.
   */
  private syncColonyStats(): void {
    const colonies = this.simulation.summaries();
    for (const colony of colonies) {
      const player = this.playerList[colony.playerId];
      if (player == null) {
        continue;
      }
      const bacteriaCount = colony.count;
      const enemyCount = strongestEnemyCount(colonies, colony);
      this.update(colony.playerId, {
        bacteriaCount,
        captured: colony.captured,
        lost: colony.lost,
        averageEnergy:
          bacteriaCount > 0 ? colony.totalEnergy / bacteriaCount : 0,
        peakCount: Math.max(player.peakCount, bacteriaCount),
        // A colony that is gone, or not counted yet, has no size to compare.
        lowestSizeRatio:
          bacteriaCount > 0 && enemyCount > 0
            ? Math.min(player.lowestSizeRatio, bacteriaCount / enemyCount)
            : player.lowestSizeRatio,
      });
    }
  }
}

/** The bacteria of the biggest colony other than `own`. */
function strongestEnemyCount(
  colonies: readonly ColonySummary[],
  own: ColonySummary
): number {
  let most = 0;
  for (const colony of colonies) {
    if (colony !== own) {
      most = Math.max(most, colony.count);
    }
  }
  return most;
}
