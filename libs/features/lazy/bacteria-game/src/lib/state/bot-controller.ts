import { weaponOf, WeaponId } from './evolution';
import { countDown } from './fixed-tick';
import { Nutrient } from './bacteria-simulation';
import { clamp, distance, Point } from './geometry';
import { ColonySummary } from './simulation';

/**
 * The computer opponent.
 *
 * It only ever does what a human can do: pick a point for its crosshair and
 * fire its boost - and a weapon, where it carries one, as a boss may. The
 * colony itself is driven by the simulation exactly like a
 * human player's, so the computer never gets stronger bacteria - it only gets
 * quicker and smarter about where to send them the harder it is set.
 *
 * The controller is free of Angular and the stores so its decisions can be
 * tested on their own.
 */

export type BotDifficulty = 'easy' | 'normal' | 'hard';

/** The difficulty a fresh game starts with. */
export const DEFAULT_DIFFICULTY: BotDifficulty = 'normal';

/** A difficulty as the menus show it. */
export interface BotDifficultyOption {
  id: BotDifficulty;
  name: string;
  description: string;
}

export const BOT_DIFFICULTIES: readonly BotDifficultyOption[] = [
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
      'Reacts fast, takes even fights, charges your nearest bacteria and boosts on contact.',
  },
];

/** The menu entry of a difficulty, null for none. */
export function difficultyOption(
  id: BotDifficulty | null
): BotDifficultyOption | null {
  return BOT_DIFFICULTIES.find((option) => option.id === id) ?? null;
}

/** A colony as the bot sees it: where it is and how strong. */
export interface ColonyView extends Point {
  count: number;
  /** Average energy relative to the normal maximum, 0..1 and beyond. */
  energy: number;
}

/**
 * How the bot finds its way to a point on the arena it plays on - straight
 * there on open ground.
 */
export interface BotRoutes {
  /** Where to send the crosshair to get the colony to a point. */
  waypoint(to: Point): Point;
  /** How far the colony has to travel to a point, infinite if it cannot. */
  travel(to: Point): number;
}

/** The weapon a bot carries, as it sees it. */
export interface BotWeaponView {
  id: WeaponId;
  /** True when it can be fired right now. */
  ready: boolean;
  /** The radius it acts in round the crosshair, in arena cells. */
  radius: number;
  /** Where the crosshair stands - where it would be fired. */
  at?: Point;
  /**
   * The bot's own bacteria and everybody else's in that circle round its
   * crosshair - worked out only when asked.
   */
  around(): { own: number; enemy: number };
}

/** Routes on open ground: straight there, as the crow flies. */
export function straightRoutes(from: Point): BotRoutes {
  return { waypoint: (to) => to, travel: (to) => distance(from, to) };
}

/** Everything the bot gets to look at before deciding. */
export interface BotView {
  width: number;
  height: number;
  /** Arena cells per base cell - the grid's resolution, not the map's size. */
  unit: number;
  own: ColonyView;
  /** The strongest enemy colony, null once there is none left. */
  enemy: ColonyView | null;
  /** The enemy bacterium closest to the own centre of mass, if any. */
  nearestEnemy: Point | null;
  nutrients: readonly Nutrient[];
  /**
   * Colonies nobody steers - neutral ones - as pellets as big as they are.
   * Food that bites back: worth it to a colony that is not hungry.
   */
  prey?: readonly Nutrient[];
  /** True on a level won by eating pellets: food before anything else. */
  feeding?: boolean;
  boostReady: boolean;
  /**
   * Where the level is won, if anywhere - the centre of the zone to hold on
   * a hold-the-zone level, else null.
   */
  objective: Point | null;
  /** The way from the own colony round the walls, and what it costs. */
  routes: BotRoutes;
  /** The weapon it carries, null without one. */
  weapon: BotWeaponView | null;
  /** The most bacteria its colony may grow to - unknown when absent. */
  capacity?: number;
}

export interface BotDecision {
  /** Where the crosshair should travel to, null to leave it where it is. */
  target: Point | null;
  /** True when the bot wants to fire its boost now. */
  boost: boolean;
  /** True when it wants to fire its weapon at its crosshair now. */
  weapon: boolean;
}

/** Where the bot steers and whether it boosts - a decision but for the weapon. */
type Course = Omit<BotDecision, 'weapon'>;

/**
 * How a bot plays: how quick, bold and accurate it is. The difficulties
 * have one each ({@link BOT_PROFILES}); on the ladder the computer plays
 * one interpolated along it (`computer-opponent.ts`), and the balance lab's
 * stand-in for a human plays {@link REFERENCE_PROFILE}.
 */
export interface BotProfile {
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
  /**
   * Times the bacteria a weapon has to catch before the bot fires it - a
   * weaker bot waits for a fatter target.
   */
  weaponPatience: number;
  /**
   * True when it charges the enemy bacterium nearest to its own colony,
   * false when it charges the enemy's centre of mass.
   */
  chargesNearest: boolean;
  /**
   * True when it attacks once its colony has grown to its cap, however big
   * the enemy: it cannot grow stronger by waiting, as a human knows - two
   * colonies at their cap that wait for each other stall the match.
   */
  attacksAtCap: boolean;
  /**
   * True when it pushes into the enemies its cryo pulse froze while the
   * pulse lasts, with a boost where it has one: they can neither flee,
   * divide nor recover. False when it goes on as before, which mostly buys
   * the enemy a pause - the balance lab measured a pulse fired that way to
   * gain nothing per shot.
   */
  pushesAfterCryo: boolean;
}

/** The profile of each difficulty - what a plain match plays. */
export const BOT_PROFILES: Readonly<Record<BotDifficulty, BotProfile>> = {
  easy: {
    reactionSec: 1.2,
    attackRatio: 1.5,
    aimNoise: 24,
    usesBoost: false,
    boostRange: 0,
    weaponPatience: 1.6,
    chargesNearest: false,
    attacksAtCap: false,
    pushesAfterCryo: false,
  },
  normal: {
    reactionSec: 0.6,
    attackRatio: 1.15,
    aimNoise: 10,
    usesBoost: true,
    boostRange: 60,
    weaponPatience: 1.25,
    chargesNearest: false,
    attacksAtCap: false,
    pushesAfterCryo: false,
  },
  hard: {
    reactionSec: 0.3,
    attackRatio: 0.9,
    aimNoise: 3,
    usesBoost: true,
    boostRange: 90,
    weaponPatience: 1,
    chargesNearest: true,
    attacksAtCap: false,
    pushesAfterCryo: false,
  },
};

/**
 * The balance lab's stand-in for a human player (ADR 0014): about as good
 * as a player at the level's stage - between the normal and the hard
 * computer. Never the computer's.
 */
export const REFERENCE_PROFILE: BotProfile = {
  reactionSec: 0.45,
  attackRatio: 1.05,
  aimNoise: 6,
  usesBoost: true,
  boostRange: 75,
  weaponPatience: 1.1,
  chargesNearest: true,
  attacksAtCap: true,
  pushesAfterCryo: true,
};

/**
 * The share of the circle a weapon has to catch filled before the bot
 * fires it at its crosshair, at its most eager: enemy bacteria for the
 * hostile weapons, its own for the others. A weapon that reaches the whole
 * colony - the shield - is fired by another rule, see `wantsWeapon`.
 */
const WEAPON_FILL: Readonly<Partial<Record<WeaponId, number>>> = {
  'toxin-bomb': 0.22,
  'cryo-pulse': 0.25,
  'phage-strike': 0.3,
  'agar-bloom': 0.3,
};
/**
 * The bot shields its colony once it is smaller than this share of the
 * enemy's and the two are this close, in cells of the base arena.
 */
const SHIELD_SIZE_RATIO = 1;
const SHIELD_RANGE = 70;

/**
 * How far a retreating colony moves away from the enemy, in cells of the base
 * arena - the bot's distances grow with a finer grid.
 */
const RETREAT_DISTANCE = 50;
/** A pellet the enemy is closer to than we are costs this much extra distance. */
const CONTESTED_PENALTY = 60;
/** Within this share of its cap a colony has grown as far as it can. */
const AT_CAP = 0.95;
/** Below this average energy the bot prefers food over a fight. */
const HUNGRY_ENERGY = 0.65;

export class BotController {
  private readonly profile: BotProfile;
  private readonly random: () => number;
  /** Seconds left until the next decision. 0 makes the first one immediate. */
  private cooldown = 0;
  /** Cells per base cell of the arena the bot last looked at. */
  private unit = 1;
  /**
   * Where its cryo pulse froze the enemy, and the seconds the push into
   * them goes on - see `pushesAfterCryo`.
   */
  private push: { at: Point; sec: number } | null = null;

  constructor(
    public readonly difficulty: BotDifficulty,
    random: () => number = Math.random,
    /** A boss: once its colony has fallen behind, it charges with every boost. */
    private readonly boss = false,
    /** How it plays - its difficulty's profile when absent. */
    profile: BotProfile = BOT_PROFILES[difficulty]
  ) {
    this.profile = profile;
    this.random = random;
  }

  /**
   * Advances the reaction timer and, when it has run out, makes a decision.
   * Between decisions the crosshair keeps travelling to the last target.
   */
  public decide(view: BotView, deltaTimeSec: number): BotDecision {
    return this.waits(deltaTimeSec)
      ? { target: null, boost: false, weapon: false }
      : this.decideNow(view);
  }

  /**
   * Advances the reaction timer - true while it has not run out, and the
   * bot does not decide yet. Once it has, {@link decideNow} decides: what
   * {@link decide} does, without a view built for a tick it waits out.
   */
  public waits(deltaTimeSec: number): boolean {
    this.cooldown = countDown(this.cooldown, deltaTimeSec);
    if (this.push !== null) {
      this.push.sec = countDown(this.push.sec, deltaTimeSec);
      if (this.push.sec === 0) {
        this.push = null;
      }
    }
    return this.cooldown > 0;
  }

  /** Makes a decision now - after {@link waits} said the bot no longer waits. */
  public decideNow(view: BotView): BotDecision {
    this.cooldown = this.profile.reactionSec;
    // The bot thinks in cells of the base arena.
    this.unit = view.unit;
    const { own, enemy } = view;
    // A boss that has fallen behind goes berserk: it charges the enemy with
    // every boost it gets - where its difficulty boosts at all.
    const course: Course =
      this.push !== null && own.count > 0
        ? {
            target: this.aim(view, this.push.at),
            boost: this.profile.usesBoost && view.boostReady,
          }
        : this.boss &&
            this.profile.usesBoost &&
            view.boostReady &&
            enemy != null &&
            own.count > 0 &&
            own.count < enemy.count
          ? {
              target: this.aim(view, this.attackPoint(view, enemy)),
              boost: true,
            }
          : this.choose(view);
    // Without a weapon nothing more is looked at - nor drawn from the
    // random numbers: a plain bot decides as it always did.
    const { weapon } = view;
    const fires =
      weapon !== null && weapon.ready && this.wantsWeapon(view, weapon);
    if (
      fires &&
      weapon.id === 'cryo-pulse' &&
      this.profile.pushesAfterCryo &&
      weapon.at !== undefined
    ) {
      this.push = { at: weapon.at, sec: weaponOf(weapon.id).durationSec };
    }
    return { ...course, weapon: fires };
  }

  /**
   * Whether to fire the weapon at the crosshair now: a hostile one once
   * enough enemies are in its circle, another over a crowd of its own, and
   * one that reaches the whole colony - the shield - when the colony is
   * losing ground in a fight.
   */
  private wantsWeapon(view: BotView, weapon: BotWeaponView): boolean {
    const { own, enemy } = view;
    if (own.count === 0 || enemy == null || enemy.count === 0) {
      return false;
    }
    const { hostile, reach } = weaponOf(weapon.id);
    if (reach === 'colony') {
      return (
        own.count < enemy.count * SHIELD_SIZE_RATIO &&
        distance(own, enemy) <= SHIELD_RANGE * this.unit
      );
    }
    const area = Math.PI * weapon.radius * weapon.radius;
    const needed =
      area * (WEAPON_FILL[weapon.id] ?? 1) * this.profile.weaponPatience;
    const around = weapon.around();
    return (hostile ? around.enemy : around.own) >= needed;
  }

  /** Where to send the crosshair now, and whether to boost. */
  private choose(view: BotView): Course {
    const { own, enemy } = view;
    if (own.count === 0) {
      return { target: null, boost: false };
    }
    const hungry = own.energy < HUNGRY_ENERGY;
    const food = this.bestNutrient(view, !hungry);
    if (enemy == null || enemy.count === 0) {
      return { target: this.aim(view, food ?? own), boost: false };
    }

    // Where the pellets win the match, they come first - stronger or not,
    // and only they: prey counts for nothing there.
    const pellet = view.feeding ? this.bestNutrient(view, false) : null;
    if (pellet != null) {
      return { target: this.aim(view, pellet), boost: false };
    }

    const stronger =
      own.count >= enemy.count * this.profile.attackRatio ||
      (this.profile.attacksAtCap &&
        view.capacity !== undefined &&
        own.count >= view.capacity * AT_CAP);

    // Where the level is won is the place to be - stronger or not, and with
    // no retreat. Only a hungry colony eats first.
    if (view.objective != null && (!hungry || food == null)) {
      return { target: this.aim(view, view.objective), boost: false };
    }

    if (stronger && !hungry) {
      const boost =
        this.profile.usesBoost &&
        view.boostReady &&
        distance(own, enemy) <= this.profile.boostRange * this.unit;
      return { target: this.aim(view, this.attackPoint(view, enemy)), boost };
    }
    if (food != null) {
      return { target: this.aim(view, food), boost: false };
    }
    return {
      // Straight away - a way round to a spot behind a wall could lead past
      // the enemy.
      target: this.aim(view, this.retreatPoint(own, enemy), false),
      boost: false,
    };
  }

  /**
   * Where to send the colony when attacking: a bold bot - the hard one -
   * charges the enemy bacterium nearest to its own colony, the others
   * charge the enemy's centre of mass.
   */
  private attackPoint(view: BotView, enemy: ColonyView): Point {
    if (this.profile.chargesNearest && view.nearestEnemy != null) {
      return view.nearestEnemy;
    }
    return enemy;
  }

  /**
   * The pellet that is cheapest to reach. A pellet the enemy stands closer to
   * than we do is probably eaten before we arrive, so it counts as further away.
   */
  private bestNutrient(view: BotView, withPrey: boolean): Nutrient | null {
    let best: Nutrient | null = null;
    let bestCost = Number.POSITIVE_INFINITY;
    const prey = withPrey ? (view.prey ?? []) : [];
    for (const nutrient of [...view.nutrients, ...prey]) {
      if (nutrient.amount <= 0) {
        continue;
      }
      // The way there, round the walls - a pellet behind one is far away.
      const ownDistance = view.routes.travel(nutrient);
      if (!isFinite(ownDistance)) {
        continue;
      }
      let cost = ownDistance;
      // Who is closer, as the crow flies on both sides.
      if (
        view.enemy != null &&
        distance(nutrient, view.enemy) < distance(nutrient, view.own)
      ) {
        cost += CONTESTED_PENALTY * this.unit;
      }
      if (cost < bestCost) {
        bestCost = cost;
        best = nutrient;
      }
    }
    return best;
  }

  /** A point straight away from the enemy, so the colony can regroup. */
  private retreatPoint(own: ColonyView, enemy: ColonyView): Point {
    const retreat = RETREAT_DISTANCE * this.unit;
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
      x: own.x + dx * retreat,
      y: own.y + dy * retreat,
    };
  }

  /**
   * Sends the crosshair on the way to a point - round the walls in between
   * - with the profile's aiming error, inside the arena.
   */
  private aim(view: BotView, destination: Point, route = true): Point {
    const point = route ? view.routes.waypoint(destination) : destination;
    const noise = this.profile.aimNoise * this.unit;
    return {
      x: clamp(point.x + (this.random() - 0.5) * 2 * noise, 0, view.width),
      y: clamp(point.y + (this.random() - 0.5) * 2 * noise, 0, view.height),
    };
  }
}

/**
 * What the bot gets to see: its own colony, the strongest enemy colony and
 * the enemy bacterium closest to its own centre of mass - from the colony
 * summaries, so it works the same whichever processor runs the war.
 */
export function buildBotView(
  width: number,
  height: number,
  own: ColonySummary,
  colonies: readonly ColonySummary[],
  nearestEnemy: (from: Point) => Point | null,
  nutrients: readonly Nutrient[],
  boostReady: boolean,
  maxEnergy: number,
  objective: Point | null,
  routes: (from: Point) => BotRoutes,
  unit: number,
  prey: readonly Nutrient[] = [],
  feeding = false,
  weapon: BotWeaponView | null = null,
  capacity?: number
): BotView {
  const ownView = colonyView(own, maxEnergy);
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

  return {
    width,
    height,
    own: ownView,
    enemy,
    nearestEnemy: enemy == null ? null : nearestEnemy(ownView),
    nutrients,
    boostReady,
    objective,
    routes: routes(ownView),
    prey,
    feeding,
    unit,
    weapon,
    ...(capacity === undefined ? {} : { capacity }),
  };
}

/**
 * A neutral colony as a bot sees it - prey as big as the colony, at its
 * centre - none once it is eaten up.
 */
export function neutralFood(colony: ColonySummary): Nutrient[] {
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
