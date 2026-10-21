import { clamp, Point } from './geometry';
import { ColonySummary } from './simulation';

/**
 * How a neutral colony gets about, in base cells - times the arena's cells
 * per base cell. It strolls; it hurries only after prey or away from a
 * threat, and even then it is slower than any crosshair.
 */
export const NEUTRAL_MOVES = {
  /** Cells per second while it wanders. */
  stroll: 12,
  /** Cells per second after prey or away from a threat. */
  hurry: 30,
  /** How close the edge of a colony it would eat has to be to be noticed. */
  sense: 70,
  /** How far it keeps the edge of a bigger colony away. */
  keepAway: 40,
  /** How far ahead it heads while it runs. */
  fleeReach: 60,
  /** How far past its edge it wanders before it picks the next spot. */
  wanderReach: 50,
  /** How far from the arena's edge it heads, at the most. */
  margin: 12,
  /** Close enough to a spot it wandered to, its centre from it. */
  arrived: 8,
} as const;

/** Seconds a neutral colony heads for a spot before it picks another. */
const WANDER_SEC = 8;
/** A colony this much smaller is prey; one this much bigger, a threat. */
const SMALLER = 0.4;
const BIGGER = 1.25;

/** Where a neutral colony heads, and how fast - in cells per second. */
export interface NeutralCourse {
  goal: Point;
  speed: number;
}

/**
 * The mind of a neutral colony. It wanders about the map, eats a colony
 * that comes near and is smaller than itself, and keeps away from one
 * that is bigger. Colonies are measured edge to edge, a colony taken as a
 * disc as big as its bacteria.
 *
 * The random numbers come from a seeded stream, so a match plays out the
 * same again from its seed.
 */
export class NeutralBrain {
  private wanderGoal: Point | null = null;
  private wanderLeftSec = 0;

  public constructor(private readonly random: () => number) {}

  /**
   * Where the colony `self` heads next, among the players' `others` - null
   * once it is gone.
   */
  public steer(
    self: ColonySummary,
    others: readonly ColonySummary[],
    width: number,
    height: number,
    unit: number,
    deltaSec: number
  ): NeutralCourse | null {
    const center = self.center;
    if (self.count === 0 || center == null) {
      return null;
    }
    const radius = discRadius(self.count);
    let threat: Point | null = null;
    let threatGap = NEUTRAL_MOVES.keepAway * unit;
    let prey: Point | null = null;
    let preyGap = NEUTRAL_MOVES.sense * unit;
    for (const other of others) {
      if (other.count === 0 || other.center == null) {
        continue;
      }
      const gap =
        Math.hypot(other.center.x - center.x, other.center.y - center.y) -
        radius -
        discRadius(other.count);
      if (other.count > self.count * BIGGER && gap < threatGap) {
        threat = other.center;
        threatGap = gap;
      } else if (other.count < self.count * SMALLER && gap < preyGap) {
        prey = other.center;
        preyGap = gap;
      }
    }

    const hurry = NEUTRAL_MOVES.hurry * unit;
    if (threat != null) {
      // Running drops the stroll - it picks a new spot once it is safe.
      this.wanderGoal = null;
      const away = this.direction(center.x - threat.x, center.y - threat.y);
      return {
        goal: this.inside(
          center.x + away.x * NEUTRAL_MOVES.fleeReach * unit,
          center.y + away.y * NEUTRAL_MOVES.fleeReach * unit,
          width,
          height,
          unit
        ),
        speed: hurry,
      };
    }
    if (prey != null) {
      return { goal: prey, speed: hurry };
    }

    this.wanderLeftSec -= deltaSec;
    const goal = this.wanderGoal;
    if (
      goal == null ||
      this.wanderLeftSec <= 0 ||
      Math.hypot(goal.x - center.x, goal.y - center.y) <
        NEUTRAL_MOVES.arrived * unit
    ) {
      const heading = this.direction(0, 0);
      // From its edge: a spot inside a big colony takes it nowhere.
      const reach =
        radius + NEUTRAL_MOVES.wanderReach * unit * (0.5 + 0.5 * this.random());
      this.wanderGoal = this.inside(
        center.x + heading.x * reach,
        center.y + heading.y * reach,
        width,
        height,
        unit
      );
      this.wanderLeftSec = WANDER_SEC;
    }
    return {
      goal: this.wanderGoal as Point,
      speed: NEUTRAL_MOVES.stroll * unit,
    };
  }

  /** That direction, one long - a random one for none. */
  private direction(x: number, y: number): Point {
    const length = Math.hypot(x, y);
    if (length > 0) {
      return { x: x / length, y: y / length };
    }
    const angle = this.random() * Math.PI * 2;
    return { x: Math.cos(angle), y: Math.sin(angle) };
  }

  /** The point, moved in off the arena's edge. */
  private inside(
    x: number,
    y: number,
    width: number,
    height: number,
    unit: number
  ): Point {
    const margin = Math.min(NEUTRAL_MOVES.margin * unit, width / 2, height / 2);
    return {
      x: clamp(x, margin, width - margin),
      y: clamp(y, margin, height - margin),
    };
  }
}

/** The radius of a disc of that many bacteria, a cell each. */
function discRadius(count: number): number {
  return Math.sqrt(count / Math.PI);
}
