import { EvolvedTraits, WeaponFire, WeaponId, weaponOf } from './evolution';
import { scaleOf } from './arena-size';
import {
  addEvents,
  BacteriaSimulation,
  noEvents,
  StepEvents,
} from './bacteria-simulation';
import { ColonySummary, Simulation, SimulationFactory } from './simulation';
import {
  BotController,
  BotProfile,
  BotRoutes,
  BotDifficulty,
  BotWeaponView,
  buildBotView,
  DEFAULT_DIFFICULTY,
  neutralFood,
} from './bot-controller';
import { countDown, TICK_SEC, TICKS_PER_SEC } from './fixed-tick';
import {
  colonyCapacity,
  GameBalance,
  gameBalance,
  PLAIN_TRAITS,
} from './game-balance';
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
import { GameMap, rectCenter } from './maps';
import {
  createPlayer,
  isBoostReady,
  isWeaponReady,
  Player,
  PlayerColorArray,
} from './player.model';
import type { SeatDriver } from './ghost';
import type { ReplayInputs } from './replay';
import {
  judgeOutcome,
  MatchOutcome,
  WinRule,
  winRuleOf,
  zoneHolder,
} from './win-conditions';
import { mapZones } from './zones';
import { NeutralBrain } from './neutral-brain';
import {
  flood,
  lineOf,
  NavField,
  NavGrid,
  navGrid,
  travel,
  waypoint,
  withWalls,
} from './bot-navigation';

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
  /** A boss's or evolved traits - plain when absent. */
  traits?: EvolvedTraits;
  /** The weapon the colony carries - none when absent. */
  weapon?: WeaponId | null;
  /** True for a boss - a boss bot charges with every boost once behind. */
  boss?: boolean;
  /**
   * True for a neutral colony: it has no crosshair and no player, and counts
   * for no side. Neutral spawns come after every player's.
   */
  neutral?: boolean;
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
   * How the computer plays - its difficulty's profile when absent. A match
   * against the computer on the ladder or a generated level takes the
   * profile of its place on the ladder (`computer-opponent.ts`).
   */
  botProfile?: BotProfile;
  /**
   * Seats a bot plays in place of a human, with the profile each is given:
   * the balance lab's stand-in (ADR 0014). Its seat spawns as a bot, and
   * its weapon is ready from the start, as a human's is.
   */
  standIns?: ReadonlyMap<number, BotProfile>;
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
  ghosts?: ReadonlyMap<number, SeatDriver>;
  /** How the match is won - by annihilation when absent. */
  win?: WinRule;
  /**
   * The seats whose inputs go into the recording - the humans at the screen
   * when absent. A seat a recording drives is recorded too when it is in
   * here, as the lockstep's are online; a bot never is (ADR 0011).
   */
  recordedSeats?: ReadonlySet<number>;
  /**
   * Called after every full second of match time with the colony sizes by
   * seat - the timeline a replay's score and summary are worked out from.
   * It only reads: nothing it does changes a tick.
   */
  onSecond?: SecondSampler;
}

/** The players' colony sizes, by seat, at the end of a second of match time. */
export type SizeSample = readonly number[];

/** Takes a match's colony sizes once a second - `second` counts from 1. */
export type SecondSampler = (sizes: SizeSample, second: number) => void;

/** A frame in which nothing happened. */
export function noFrameEvents(): FrameEvents {
  return { ...noEvents(), boosts: [], weapons: [] };
}

/** What happened during a frame - the simulation's events and the boosts. */
export interface FrameEvents extends StepEvents {
  /** One entry per boost fired since the frame before, true for the computer's. */
  boosts: boolean[];
  /** The weapons fired since the frame before. */
  weapons: WeaponFire[];
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

/** A value put on one of those grids. */
export function onGrid(value: number, steps: number): number {
  // `|| 0` turns a rounded -0 into 0, as it comes back from a link.
  return Math.round(value * steps) / steps || 0;
}

/** A neutral colony's mind, and how far its pace has carried it so far. */
interface NeutralMover {
  seat: number;
  brain: NeutralBrain;
  /** Its crosshair, moved where its mind sends it on the ticks it steps. */
  crosshair: Player;
  /** The part of a step it has made up and not yet taken. */
  pace: number;
}

/** A crosshair nobody steers. */
const AT_REST: SteeringVector = Object.freeze({ x: 0, y: 0 });

/** A weapon fired, waiting for the next step of the war to act in. */
interface Shot {
  playerId: number;
  weapon: WeaponId;
  /** The crosshair it was fired at. */
  x: number;
  y: number;
}

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
  /** The most bacteria a colony of this match may grow to. */
  public readonly capacity: number;
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
  /** Weapons fired since the last frame. */
  private firedWeapons: WeaponFire[] = [];
  /** Weapons fired since the last tick, which act from its step on. */
  private shots: Shot[] = [];
  /** What the ticks of the frame under way did so far. */
  private tickEvents: StepEvents = noEvents();
  private ticks = 0;
  /** What the recorded seats put in, for the replay. */
  private readonly inputs: ReplayInputs = {
    steers: [],
    drags: [],
    boosts: [],
    weapons: [],
  };
  /** The players a recording drives, by seat. */
  private readonly ghosts: ReadonlyMap<number, SeatDriver>;
  /** The seats to record - null for the humans at the screen. */
  private readonly recordedSeats: ReadonlySet<number> | null;
  private readonly onSecond: SecondSampler | null;
  private readonly win: WinRule;
  /** Each seat's traits, a boss's, evolved ones or none. */
  private readonly traits: readonly (EvolvedTraits | undefined)[];
  /** The layout of the match - for the hold zone the bots head for. */
  private readonly map: GameMap;
  /**
   * The colony summaries the hold time was last credited from, and the tick
   * count up to which it was. The GPU reports a few ticks late and now and
   * then not at all for a while: each report credits the ticks since the one
   * before to whoever holds the zone in it.
   */
  private heldFrom: readonly ColonySummary[] | null = null;
  private heldUpTo = 0;
  /** The bots' grid of the static walls and the zones, by arena size. */
  private nav: { width: number; height: number; grid: NavGrid } | null = null;
  /** True when the match has neutral colonies - see {@link neutralCount}. */
  private readonly hasNeutral: boolean;
  /** The neutral colonies' bacteria, all together. */
  private neutralBacteria = 0;
  /** What moves each neutral colony, in seat order. */
  private readonly neutralMovers: readonly NeutralMover[];
  /** The centre of the hold zone on the arena last asked for, by its size. */
  private hill: { width: number; height: number; at: Point | null } | null =
    null;

  public constructor(spawns: readonly PlayerSpawn[], options: MatchOptions) {
    this.seed = options.seed;
    this.balance = options.balance ?? gameBalance;
    this.ghosts = options.ghosts ?? new Map();
    this.recordedSeats = options.recordedSeats ?? null;
    this.onSecond = options.onSecond ?? null;
    this.win = winRuleOf(options);
    this.traits = spawns.map((spawn) => spawn.traits);
    this.capacity = colonyCapacity(this.balance, spawns.length);
    this.map = options.map ?? getMap('corridors');
    const players = spawns.filter((spawn) => spawn.neutral !== true);
    if (spawns.slice(0, players.length).some((spawn) => spawn.neutral)) {
      throw new Error('Neutral colonies spawn after every player.');
    }
    this.hasNeutral = players.length < spawns.length;
    this.neutralMovers = spawns.slice(players.length).map((spawn, index) => {
      const seat = players.length + index;
      return {
        seat,
        brain: new NeutralBrain(seeded(streamSeed(this.seed, seat + 1))),
        crosshair: createPlayer({ id: seat, color: spawn.color }),
        pace: 0,
      };
    });
    this.playerList = players.map((spawn, index) => {
      const standIn = options.standIns?.get(index);
      if (spawn.isBot && !this.ghosts.has(index)) {
        this.bots.set(
          index,
          new BotController(
            options.difficulty ?? DEFAULT_DIFFICULTY,
            seeded(streamSeed(this.seed, index + 1)),
            spawn.boss === true,
            standIn ?? options.botProfile
          )
        );
      }
      // The computer's weapon starts charging, so its first shot is not
      // at the human's spawn a second into the match; a human's is ready.
      const charging =
        spawn.weapon != null && this.bots.has(index) && standIn === undefined
          ? this.weaponCooldown(index, spawn.weapon)
          : 0;
      return createPlayer({
        id: index,
        x: spawn.x,
        y: spawn.y,
        color: spawn.color,
        name: spawn.name,
        isBot: spawn.isBot,
        maxSpeed: options.crosshairSpeed ?? DEFAULT_CROSSHAIR_SPEED,
        weapon: spawn.weapon ?? null,
        weaponCooldownSec: charging,
        weaponCooldownFullSec: charging,
      });
    });

    this.simulation = (options.simulation ?? cpuSimulation)(
      this.balance,
      seeded(this.seed)
    );
    if (options.arena != null) {
      this.simulation.resize(options.arena.width, options.arena.height);
    }
    this.simulation.setMap(this.map);
    const radius = this.balance.startBacteriaRadius;
    this.simulation.init(
      spawns.map((spawn, index) => ({
        playerId: index,
        color: spawn.color,
        x: spawn.x,
        y: spawn.y,
        // The scale is one of area: the radius shrinks by its root.
        radius: Math.max(1, radius * Math.sqrt(spawn.startScale ?? 1)),
        traits: spawn.traits,
      }))
    );
    this.syncColonyStats();
    this.ownsPlayers = false;
  }

  /** The players as they stand after the last tick. */
  public get players(): readonly Player[] {
    return this.playerList;
  }

  /** The bacteria of the neutral colonies, all together - null without any. */
  public get neutralCount(): number | null {
    return this.hasNeutral ? this.neutralBacteria : null;
  }

  /** Ticks played so far. */
  public get tickCount(): number {
    return this.ticks;
  }

  /** What the recorded seats put in so far - a match's worth once it is over. */
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

  /**
   * Fires a player's weapon at their crosshair. Nothing happens without a
   * weapon or while it recharges. Returns whether it fired.
   */
  public fireWeapon(playerId: number): boolean {
    if (!this.isLive(playerId)) {
      return false;
    }
    return this.shoot(playerId);
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
    this.tickTimers();
    this.runBots(width, height);
    this.launchShots(width);
    this.simulation.step(this.steerNeutrals(width, height), TICK_SEC);
    this.tickEvents = addEvents(this.tickEvents, this.simulation.getEvents());
    this.syncColonyStats(true);
    this.ownsPlayers = false;
    this.ticks++;
    if (this.onSecond !== null && this.ticks % TICKS_PER_SEC === 0) {
      this.onSecond(
        this.playerList.map((player) => player.bacteriaCount),
        this.ticks / TICKS_PER_SEC
      );
    }
  }

  /**
   * Closes a display frame: what its ticks did, and the boosts fired since
   * the last one, become the frame's events.
   */
  public takeFrameEvents(): FrameEvents {
    const events = {
      ...this.tickEvents,
      boosts: this.firedBoosts,
      weapons: this.firedWeapons,
    };
    this.tickEvents = noEvents();
    this.firedBoosts = [];
    this.firedWeapons = [];
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
    const cooldown =
      this.balance.boostCooldownSec *
      (this.traits[playerId] ?? PLAIN_TRAITS).cooldownFactor;
    this.update(playerId, {
      boostActiveSec: this.balance.boostDurationSec,
      boostCooldownSec: cooldown,
      boostCooldownFullSec: cooldown,
      boostsFired: player.boostsFired + 1,
    });
    this.ownsPlayers = false;
    this.firedBoosts.push(player.isBot);
    if (this.isRecorded(playerId)) {
      // Fired between two ticks, it counts from the next one on.
      this.inputs.boosts.push([this.ticks, playerId]);
    }
    return true;
  }

  /**
   * Fires a player's weapon at their crosshair, when it is ready: its
   * effect acts from the next step of the war on, and its cooldown starts
   * once the effect has run out - as a boost's does.
   */
  private shoot(playerId: number): boolean {
    const player = this.playerList[playerId];
    if (player?.weapon == null || !isWeaponReady(player)) {
      return false;
    }
    const weapon = weaponOf(player.weapon);
    const cooldown = this.weaponCooldown(playerId, weapon.id);
    this.update(playerId, {
      weaponActiveSec: weapon.durationSec,
      weaponCooldownSec: cooldown,
      weaponCooldownFullSec: cooldown,
      weaponsFired: player.weaponsFired + 1,
    });
    this.ownsPlayers = false;
    this.shots.push({
      playerId,
      weapon: weapon.id,
      x: player.x,
      y: player.y,
    });
    if (this.isRecorded(playerId)) {
      // Fired between two ticks, it counts from the next one on.
      this.inputs.weapons.push([this.ticks, playerId]);
    }
    return true;
  }

  /** The seconds a seat's weapon takes to recharge, its genes counted. */
  private weaponCooldown(playerId: number, id: WeaponId): number {
    return (
      weaponOf(id).cooldownSec *
      (this.traits[playerId]?.weaponCooldownFactor ?? 1)
    );
  }

  /**
   * Hands the weapons fired since the last tick to the war, their radius
   * grown with the grid, and notes them for the frame's events.
   */
  private launchShots(width: number): void {
    if (this.shots.length === 0) {
      return;
    }
    const unit = this.unitAt(width);
    for (const { playerId, weapon: id, x, y } of this.shots) {
      const weapon = weaponOf(id);
      const radius = weapon.radius * unit;
      this.simulation.addEffect({
        weapon: id,
        owner: playerId,
        x,
        y,
        radius,
        remainingSec: weapon.durationSec,
        durationSec: weapon.durationSec,
      });
      this.firedWeapons.push({
        playerId,
        weapon: id,
        x,
        y,
        radius,
        isBot: this.playerList[playerId]?.isBot ?? false,
      });
    }
    this.shots = [];
  }

  /** True for a seat whose inputs go into the recording. */
  private isRecorded(playerId: number): boolean {
    return this.recordedSeats === null
      ? this.isLive(playerId)
      : this.recordedSeats.has(playerId) && !this.bots.has(playerId);
  }

  /** Records what the recorded seats changed since the last tick. */
  private record(): void {
    for (const [playerId, { x, y }] of this.newDrags) {
      if (this.isRecorded(playerId)) {
        this.inputs.drags.push([this.ticks, playerId, x, y]);
      }
    }
    this.newDrags.clear();
    for (const player of this.playerList) {
      if (!this.isRecorded(player.id)) {
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
      const { boost, drag, steer, weapon } = ghost.before(this.ticks);
      if (boost) {
        this.fireBoost(playerId);
      }
      if (weapon) {
        this.shoot(playerId);
      }
      if (drag != null) {
        this.dragTargets.set(playerId, drag);
        // Only recorded seats, so a ghost's turned drags never get in.
        if (this.isRecorded(playerId)) {
          this.newDrags.set(playerId, drag);
        }
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
   * Counts the boost and weapon timers down. Each runs its effect out
   * first, only then does its recharge start - so a player waits the full
   * cooldown after firing.
   */
  private tickTimers(): void {
    for (const player of this.playerList) {
      let change: Partial<Player> | null = null;
      if (player.boostActiveSec > 0) {
        change = { boostActiveSec: countDown(player.boostActiveSec) };
      } else if (player.boostCooldownSec > 0) {
        change = { boostCooldownSec: countDown(player.boostCooldownSec) };
      }
      if (player.weaponActiveSec > 0) {
        change ??= {};
        change.weaponActiveSec = countDown(player.weaponActiveSec);
      } else if (player.weaponCooldownSec > 0) {
        change ??= {};
        change.weaponCooldownSec = countDown(player.weaponCooldownSec);
      }
      if (change !== null) {
        this.update(player.id, change);
      }
    }
  }

  /**
   * What a bot sees of the weapon it carries, null without one - built only
   * when it decides: the bacteria round its crosshair are counted only when
   * it asks, from the blocks the simulation counts - a few times a second
   * at the most.
   */
  private botWeaponView(player: Player, width: number): BotWeaponView | null {
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
    const blocks = this.simulation.blockCounts();
    const around = { own: 0, enemy: 0 };
    if (blocks === null) {
      return around;
    }
    const { blocksX, blocksY, cellSize, counts } = blocks;
    const own = this.simulation
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
   * The ways round the walls from a bot's colony. The grid and the flood
   * are only worked out once the bot asks - it decides a few times a second,
   * not every tick.
   */
  private routesFrom(from: Point, width: number, height: number): BotRoutes {
    let grid: NavGrid | null = null;
    let field: NavField | null = null;
    const grid$ = () => (grid ??= this.navGridAt(width, height));
    const field$ = () => (field ??= flood(grid$(), from));
    // A clear straight line needs no flood - most decisions on open ground.
    const clear = (to: Point) => lineOf(grid$(), from, to) === 'clear';
    return {
      waypoint: (to) => (clear(to) ? to : waypoint(field$(), to)),
      travel: (to) =>
        clear(to)
          ? Math.hypot(to.x - from.x, to.y - from.y)
          : travel(field$(), to),
    };
  }

  /**
   * The grid the bots plan on: the static walls and the zones, and the
   * gates and sliding walls that are shut - or about to shut - right now.
   */
  private navGridAt(width: number, height: number): NavGrid {
    if (this.nav?.width !== width || this.nav.height !== height) {
      this.nav = {
        width,
        height,
        grid: navGrid(
          width,
          height,
          this.map.createWalls(width, height),
          mapZones(this.map, width, height),
          this.unitAt(width)
        ),
      };
    }
    return withWalls(
      this.nav.grid,
      this.simulation
        .getDynamicWalls()
        .filter((wall) => wall.solid || wall.warning > 0)
    );
  }

  /**
   * The centre of the zone a hold-the-zone level is won on, on an arena of
   * that size - null on any other level.
   */
  private hillAt(width: number, height: number): Point | null {
    if (this.win.kind !== 'hold') {
      return null;
    }
    if (this.hill?.width !== width || this.hill.height !== height) {
      const zone = mapZones(this.map, width, height).find(
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

  /** Lets every computer opponent look at the arena and steer its crosshair. */
  private runBots(width: number, height: number): void {
    if (this.bots.size === 0) {
      return;
    }
    const { players: colonies, neutral } = this.splitColonies();
    // A neutral colony is no enemy to the bots: it is prey, food that bites.
    const prey = neutral.flatMap(neutralFood);
    for (const [playerId, bot] of this.bots) {
      const player = this.playerList[playerId];
      const own = colonies.find((colony) => colony.playerId === playerId);
      // Between its decisions the bot looks at nothing: no view to build.
      if (player == null || own == null || bot.waits(TICK_SEC)) {
        continue;
      }
      const view = buildBotView(
        width,
        height,
        own,
        colonies,
        // The simulation's nearest enemy may be a neutral bacterium: with
        // neutral colonies about, the bots charge the enemy's centre.
        (from) =>
          this.hasNeutral ? null : this.simulation.nearestEnemy(playerId, from),
        this.simulation.getNutrients(),
        isBoostReady(player),
        this.balance.maxEnergy,
        this.hillAt(width, height),
        (from) => this.routesFrom(from, width, height),
        this.unitAt(width),
        prey,
        this.win.kind === 'harvest',
        this.botWeaponView(player, width),
        this.capacity
      );
      const decision = bot.decideNow(view);
      if (decision.target != null) {
        this.dragTargets.set(playerId, decision.target);
      }
      if (decision.boost) {
        this.fireBoost(playerId);
      }
      if (decision.weapon) {
        this.shoot(playerId);
      }
    }
  }

  /**
   * The crosshairs the war steps with: the players', and one for each
   * neutral colony that moves this tick, where its mind sends it. A neutral
   * colony is slower than a step a tick: it steps on the ticks its pace has
   * made up a step for, and stays put on the others.
   */
  private steerNeutrals(width: number, height: number): Player[] {
    if (this.neutralMovers.length === 0) {
      return this.playerList;
    }
    const { players: colonies, neutral } = this.splitColonies();
    const unit = this.unitAt(width);
    let steered: Player[] | null = null;
    for (const mover of this.neutralMovers) {
      const own = neutral.find((colony) => colony.playerId === mover.seat);
      const course =
        own?.center == null
          ? null
          : mover.brain.steer(own, colonies, width, height, unit, TICK_SEC);
      if (own?.center == null || course == null) {
        continue;
      }
      mover.pace += course.speed * TICK_SEC;
      const steps = Math.floor(mover.pace);
      if (steps === 0) {
        continue;
      }
      mover.pace -= steps;
      // Around the walls, as the bots go, not into the one in the way.
      const at = this.routesFrom(own.center, width, height).waypoint(
        course.goal
      );
      mover.crosshair = {
        ...mover.crosshair,
        x: at.x,
        y: at.y,
        maxSpeed: steps / TICK_SEC,
      };
      steered ??= [...this.playerList];
      steered.push(mover.crosshair);
    }
    return steered ?? this.playerList;
  }

  /** Arena cells per base cell on an arena that wide - the grid's resolution. */
  private unitAt(width: number): number {
    return scaleOf(width, this.map.size);
  }

  /**
   * The colonies of the last step, split: the players' and the neutral ones
   * - those past the last player's seat. A neutral colony fights, but counts
   * for nobody: not as an enemy to measure up against, not as the one
   * holding the zone.
   */
  private splitColonies(): {
    all: readonly ColonySummary[];
    players: readonly ColonySummary[];
    neutral: readonly ColonySummary[];
  } {
    const all = this.simulation.summaries();
    if (!this.hasNeutral) {
      return { all, players: all, neutral: [] };
    }
    const seats = this.playerList.length;
    return {
      all,
      players: all.filter(({ playerId }) => playerId < seats),
      neutral: all.filter(({ playerId }) => playerId >= seats),
    };
  }

  /**
   * Takes the colony scoreboard over into the players - with the peak and
   * the lowest size ratio the match is judged on, and after a tick played
   * (`ticked`) the time the hold zone was held.
   */
  private syncColonyStats(ticked = false): void {
    const { all, players: colonies, neutral } = this.splitColonies();
    this.neutralBacteria = neutral.reduce((sum, { count }) => sum + count, 0);
    // On a hold-the-zone level, the ticks played since the last report are
    // held by the colony with the most bacteria on the zone in this one.
    let holder: number | null = null;
    let held = 0;
    if (ticked && this.win.kind === 'hold' && all !== this.heldFrom) {
      this.heldFrom = all;
      held = this.ticks + 1 - this.heldUpTo;
      this.heldUpTo = this.ticks + 1;
      holder = zoneHolder(colonies);
    }
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
        holdTicks: player.holdTicks + (colony.playerId === holder ? held : 0),
        pellets: colony.pellets,
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
