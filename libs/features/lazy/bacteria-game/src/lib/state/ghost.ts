import { Point, SteeringVector } from './geometry';
import { mirrorPoint } from './maps';
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
    point: (point) => {
      const { x, y } = mirrorPoint(point, from.width, from.height);
      return { x: x * scaleX, y: y * scaleY };
    },
    // 0 - x rather than -x: a zero stays a zero, not -0.
    direction: ({ x, y }) => ({ x: 0 - x, y: 0 - y }),
  };
}

/** What a ghost puts in before a tick - null where it changes nothing. */
export interface GhostInputs {
  boost: boolean;
  drag: Point | null;
  steer: SteeringVector | null;
}

/** One list of a recording, read in the order of its ticks. */
class Cursor<T extends readonly number[]> {
  private index = 0;

  public constructor(private readonly list: readonly T[]) {}

  /** Every input due by `tick` that was not read yet, in order. */
  public *dueBy(tick: number): Generator<T> {
    while (this.index < this.list.length && this.list[this.index][0] <= tick) {
      yield this.list[this.index++];
    }
  }
}

/**
 * A crosshair driven by what a human put in during a recorded match: the
 * replay plays every human back this way, a ghost match one of them against
 * a live player.
 */
export class GhostController {
  private readonly steers: Cursor<ReplayInputs['steers'][number]>;
  private readonly drags: Cursor<ReplayInputs['drags'][number]>;
  private readonly boosts: Cursor<ReplayInputs['boosts'][number]>;

  /** Plays the inputs of `seat` in the recording, mapped by `mapping`. */
  public constructor(
    inputs: ReplayInputs,
    seat: number,
    private readonly mapping: GhostMapping = SAME_BOARD
  ) {
    const of = <T extends readonly number[]>(list: readonly T[]) =>
      new Cursor(list.filter((input) => input[1] === seat));
    this.steers = of(inputs.steers);
    this.drags = of(inputs.drags);
    this.boosts = of(inputs.boosts);
  }

  /** What the human put in before `tick`, each kind's last input winning. */
  public before(tick: number): GhostInputs {
    const inputs: GhostInputs = { boost: false, drag: null, steer: null };
    inputs.boost = [...this.boosts.dueBy(tick)].length > 0;
    for (const [, , x, y] of this.drags.dueBy(tick)) {
      inputs.drag = this.mapping.point({ x, y });
    }
    for (const [, , x, y] of this.steers.dueBy(tick)) {
      inputs.steer = this.mapping.direction({ x, y });
    }
    return inputs;
  }
}
