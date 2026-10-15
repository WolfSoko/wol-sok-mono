import { Nutrient } from './bacteria-simulation';

/**
 * The computer opponent.
 *
 * It only ever does what a human can do: pick a point for its crosshair and
 * fire its boost. The colony itself is driven by the simulation exactly like a
 * human player's, so the computer never gets stronger bacteria - it only gets
 * quicker and smarter about where to send them the harder it is set.
 *
 * The controller is free of Angular and the stores so its decisions can be
 * tested on their own.
 */

export type BotDifficulty = 'easy' | 'normal' | 'hard';

export const BOT_DIFFICULTIES: readonly {
  id: BotDifficulty;
  name: string;
  description: string;
}[] = [
  {
    id: 'easy',
    name: 'Easy',
    description: 'Slow to react, never boosts and only attacks when far ahead.',
  },
  {
    id: 'normal',
    name: 'Normal',
    description:
      'Feeds first, attacks when stronger and boosts to break through.',
  },
  {
    id: 'hard',
    name: 'Hard',
    description:
      'Reacts fast, takes even fights, aims at your weakest spot and boosts on contact.',
  },
];

/** A colony as the bot sees it: where it is and how strong. */
export interface ColonyView {
  /** Centre of mass of the bacteria. */
  x: number;
  y: number;
  count: number;
  /** Average energy relative to the normal maximum, 0..1 and beyond. */
  energy: number;
}

/** Everything the bot gets to look at before deciding. */
export interface BotView {
  width: number;
  height: number;
  own: ColonyView;
  /** The strongest enemy colony, null once there is none left. */
  enemy: ColonyView | null;
  /** The enemy bacterium closest to the own centre of mass, if any. */
  nearestEnemy: { x: number; y: number } | null;
  nutrients: readonly Nutrient[];
  boostReady: boolean;
}

export interface BotDecision {
  /** Where the crosshair should travel to, null to leave it where it is. */
  target: { x: number; y: number } | null;
  /** True when the bot wants to fire its boost now. */
  boost: boolean;
}

interface Profile {
  /** Seconds between two decisions. */
  reactionSec: number;
  /** The bot attacks once its colony is this many times the enemy's size. */
  attackRatio: number;
  /** Random offset added to every target, in arena pixels. */
  aimNoise: number;
  /** Whether the bot fires its boost at all. */
  usesBoost: boolean;
  /** Distance to the enemy below which an attacking bot fires its boost. */
  boostRange: number;
}

const PROFILES: Record<BotDifficulty, Profile> = {
  easy: {
    reactionSec: 1.2,
    attackRatio: 1.5,
    aimNoise: 24,
    usesBoost: false,
    boostRange: 0,
  },
  normal: {
    reactionSec: 0.6,
    attackRatio: 1.15,
    aimNoise: 10,
    usesBoost: true,
    boostRange: 60,
  },
  hard: {
    reactionSec: 0.3,
    attackRatio: 0.9,
    aimNoise: 3,
    usesBoost: true,
    boostRange: 90,
  },
};

/** How far a retreating colony moves away from the enemy, in arena pixels. */
const RETREAT_DISTANCE = 50;
/** A pellet the enemy is closer to than we are costs this much extra distance. */
const CONTESTED_PENALTY = 60;
/** Below this average energy the bot prefers food over a fight. */
const HUNGRY_ENERGY = 0.65;

export class BotController {
  private readonly profile: Profile;
  private readonly random: () => number;
  /** Seconds left until the next decision. 0 makes the first one immediate. */
  private cooldown = 0;

  constructor(
    public readonly difficulty: BotDifficulty,
    random: () => number = Math.random
  ) {
    this.profile = PROFILES[difficulty];
    this.random = random;
  }

  /**
   * Advances the reaction timer and, when it has run out, makes a decision.
   * Between decisions the crosshair keeps travelling to the last target.
   */
  public decide(view: BotView, deltaTimeSec: number): BotDecision {
    this.cooldown -= deltaTimeSec;
    if (this.cooldown > 0) {
      return { target: null, boost: false };
    }
    this.cooldown = this.profile.reactionSec;

    const { own, enemy } = view;
    if (own.count === 0) {
      return { target: null, boost: false };
    }
    if (enemy == null || enemy.count === 0) {
      return {
        target: this.aim(view, this.bestNutrient(view) ?? own),
        boost: false,
      };
    }

    const stronger = own.count >= enemy.count * this.profile.attackRatio;
    const hungry = own.energy < HUNGRY_ENERGY;
    const food = this.bestNutrient(view);

    if (stronger && !hungry) {
      const distance = Math.hypot(enemy.x - own.x, enemy.y - own.y);
      const boost =
        this.profile.usesBoost &&
        view.boostReady &&
        distance <= this.profile.boostRange;
      return { target: this.aim(view, this.attackPoint(view)), boost };
    }
    if (food != null) {
      return { target: this.aim(view, food), boost: false };
    }
    return { target: this.aim(view, this.retreatPoint(view)), boost: false };
  }

  /**
   * Where to send the colony when attacking: the hard bot goes for the nearest
   * enemy bacteria, which is the thinnest part of the front, the others charge
   * the enemy's centre of mass.
   */
  private attackPoint(view: BotView): { x: number; y: number } {
    const enemy = view.enemy as ColonyView;
    if (this.difficulty === 'hard' && view.nearestEnemy != null) {
      return view.nearestEnemy;
    }
    return enemy;
  }

  /**
   * The pellet that is cheapest to reach. A pellet the enemy stands closer to
   * than we do is probably eaten before we arrive, so it counts as further away.
   */
  private bestNutrient(view: BotView): Nutrient | null {
    let best: Nutrient | null = null;
    let bestCost = Number.POSITIVE_INFINITY;
    for (const nutrient of view.nutrients) {
      if (nutrient.amount <= 0) {
        continue;
      }
      const ownDistance = Math.hypot(
        nutrient.x - view.own.x,
        nutrient.y - view.own.y
      );
      let cost = ownDistance;
      if (view.enemy != null) {
        const enemyDistance = Math.hypot(
          nutrient.x - view.enemy.x,
          nutrient.y - view.enemy.y
        );
        if (enemyDistance < ownDistance) {
          cost += CONTESTED_PENALTY;
        }
      }
      if (cost < bestCost) {
        bestCost = cost;
        best = nutrient;
      }
    }
    return best;
  }

  /** A point straight away from the enemy, so the colony can regroup. */
  private retreatPoint(view: BotView): { x: number; y: number } {
    const { own, enemy } = view;
    if (enemy == null) {
      return own;
    }
    let dx = own.x - enemy.x;
    let dy = own.y - enemy.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) {
      dx = 1;
      dy = 0;
    } else {
      dx /= length;
      dy /= length;
    }
    return {
      x: own.x + dx * RETREAT_DISTANCE,
      y: own.y + dy * RETREAT_DISTANCE,
    };
  }

  /** Adds the profile's aiming error and keeps the point inside the arena. */
  private aim(
    view: BotView,
    point: { x: number; y: number }
  ): { x: number; y: number } {
    const noise = this.profile.aimNoise;
    return {
      x: clamp(point.x + (this.random() - 0.5) * 2 * noise, 0, view.width),
      y: clamp(point.y + (this.random() - 0.5) * 2 * noise, 0, view.height),
    };
  }
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
