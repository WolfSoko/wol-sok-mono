import { Point, SteeringVector } from './geometry';
import type { ReplayInputs } from './replay';

/** How a recording's board maps onto the board it is played on. */
export interface GhostMapping {
  point(point: Point): Point;
  direction(direction: SteeringVector): SteeringVector;
}

/** The board of the recording, as it is. */
export const SAME_BOARD: GhostMapping = {
  point: (point) => point,
  direction: (direction) => direction,
};

/**
 * The recording turned through the centre of the board and stretched onto
 * one of another size: what the left colony did, done by the right one. The
 * maps are point symmetric, so the turned recording meets the same walls.
 */
export function turnedOnto(
  from: { width: number; height: number },
  to: { width: number; height: number }
): GhostMapping {
  const scaleX = to.width / from.width;
  const scaleY = to.height / from.height;
  return {
    point: ({ x, y }) => ({
      x: (from.width - x) * scaleX,
      y: (from.height - y) * scaleY,
    }),
    direction: ({ x, y }) => ({ x: x === 0 ? 0 : -x, y: y === 0 ? 0 : -y }),
  };
}

/** What a ghost puts in before a tick - null where it changes nothing. */
export interface GhostInputs {
  boost: boolean;
  drag: Point | null;
  steer: SteeringVector | null;
}

/**
 * A crosshair driven by what a human put in during a recorded match: the
 * replay plays every human back this way, a ghost match one of them against
 * a live player.
 */
export class GhostController {
  private readonly steers: ReplayInputs['steers'];
  private readonly drags: ReplayInputs['drags'];
  private readonly boosts: ReplayInputs['boosts'];
  private readonly next = { steers: 0, drags: 0, boosts: 0 };

  /** Plays the inputs of `seat` in the recording, mapped by `mapping`. */
  public constructor(
    inputs: ReplayInputs,
    seat: number,
    private readonly mapping: GhostMapping = SAME_BOARD
  ) {
    this.steers = inputs.steers.filter(([, player]) => player === seat);
    this.drags = inputs.drags.filter(([, player]) => player === seat);
    this.boosts = inputs.boosts.filter(([, player]) => player === seat);
  }

  /** What the human put in before `tick`, each kind's last input winning. */
  public before(tick: number): GhostInputs {
    let boost = false;
    while (this.due(this.boosts, 'boosts', tick) != null) {
      boost = true;
    }
    let drag: Point | null = null;
    for (let at; (at = this.due(this.drags, 'drags', tick));) {
      drag = this.mapping.point({ x: at[2], y: at[3] });
    }
    let steer: SteeringVector | null = null;
    for (let at; (at = this.due(this.steers, 'steers', tick));) {
      steer = this.mapping.direction({ x: at[2], y: at[3] });
    }
    return { boost, drag, steer };
  }

  /** The next input of a list if it is due by `tick` - taken off the list. */
  private due<T extends readonly number[]>(
    list: readonly T[],
    kind: keyof GhostController['next'],
    tick: number
  ): T | null {
    const input = list[this.next[kind]];
    if (input == null || input[0] > tick) {
      return null;
    }
    this.next[kind]++;
    return input;
  }
}
