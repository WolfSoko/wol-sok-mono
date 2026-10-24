import { clampLength, SteeringVector } from '../state/geometry';
import { DRAG_STEPS, onGrid, STEER_STEPS } from '../state/match-engine';
import { GhostInputs, NO_INPUT, SeatDriver } from '../state/ghost';
import { TICKS_PER_SEC } from '../state/fixed-tick';
import { matchChecksum } from '../state/checksum';
import { Player } from '../state/player.model';
import { NetMessage, TickInput } from './net-message';

/** Moved to `state/checksum.ts` (ADR 0011); kept here for the net code. */
export { matchChecksum } from '../state/checksum';

/**
 * How many ticks after it is put in an input is played: 100 ms at 60 ticks
 * a second. Enough for it to reach the other device on most connections
 * before that device plays the tick - a colony follows its crosshair slowly
 * anyway, so nobody feels the delay.
 */
export const INPUT_DELAY_TICKS = TICKS_PER_SEC / 10;

/** How often the two devices compare their matches: once a second. */
export const CHECK_EVERY_TICKS = TICKS_PER_SEC;

/**
 * The input of every seat for every tick, put together from this device and
 * the other one: an online match runs the same engine with the same seed on
 * both devices, and each tick is only played once both seats' inputs for it
 * are in - the lockstep. Both devices then play the very same match.
 *
 * What the player at this device puts in is played {@link delay} ticks
 * later on both devices, so the other device has it in time. Once a second
 * the devices exchange a checksum of the match; should they ever disagree -
 * floating point that differs between browsers, say - the match is over.
 */
export class Lockstep {
  /** The inputs by seat, then by tick. */
  private readonly inputs = [
    new Map<number, GhostInputs>(),
    new Map<number, GhostInputs>(),
  ];
  /** This device's checksums by tick, until the other one's arrives. */
  private readonly localSums = new Map<number, number>();
  /** The other device's checksums by tick, until this one's is made. */
  private readonly remoteSums = new Map<number, number>();
  private outOfSync = false;

  public constructor(
    /** The seat of the player at this device - 0 for the host. */
    public readonly localSeat: 0 | 1,
    private readonly send: (message: NetMessage) => void,
    /** The match's number, which its messages carry. */
    private readonly match = 0,
    public readonly delay = INPUT_DELAY_TICKS
  ) {}

  /** The other device's seat. */
  public get remoteSeat(): 0 | 1 {
    return this.localSeat === 0 ? 1 : 0;
  }

  /** True once the two devices played different matches. */
  public get desynced(): boolean {
    return this.outOfSync;
  }

  /** What drives both seats in the engine, read tick by tick. */
  public drivers(): Map<number, SeatDriver> {
    return new Map([0, 1].map((seat) => [seat, this.driver(seat)]));
  }

  /** True once both seats' inputs for `tick` are in. */
  public ready(tick: number): boolean {
    return (
      tick < this.delay ||
      (this.inputs[0].has(tick) && this.inputs[1].has(tick))
    );
  }

  /**
   * Takes what the player at this device put in while `tick` is played -
   * the push in arena directions, a drag target, a boost - and sends it to
   * the other device, for both to play {@link delay} ticks later.
   */
  public putLocal(
    tick: number,
    push: SteeringVector,
    drag: { x: number; y: number } | null,
    boost: boolean
  ): void {
    // A key and the stick together push no harder than either.
    const steer = clampLength(push, 1);
    const input: TickInput = {
      steer: [onGrid(steer.x, STEER_STEPS), onGrid(steer.y, STEER_STEPS)],
      drag:
        drag === null
          ? null
          : [onGrid(drag.x, DRAG_STEPS), onGrid(drag.y, DRAG_STEPS)],
      boost,
    };
    const due = tick + this.delay;
    this.inputs[this.localSeat].set(due, played(input));
    this.send({ k: 'in', n: this.match, t: due, ...input });
  }

  /** Takes an input the other device sent. */
  public putRemote(tick: number, input: TickInput): void {
    // Its first inputs are due after the delay; an earlier one is made up.
    if (tick >= this.delay) {
      this.inputs[this.remoteSeat].set(tick, played(input));
    }
  }

  /**
   * Notes the match as it stands after `tick` ticks - and on every
   * {@link CHECK_EVERY_TICKS}th tick tells the other device its checksum.
   */
  public ticked(tick: number, players: readonly Player[]): void {
    if (tick % CHECK_EVERY_TICKS !== 0) {
      return;
    }
    const sum = matchChecksum(players);
    this.send({ k: 'sum', n: this.match, t: tick, h: sum });
    this.compare(tick, sum, this.remoteSums, this.localSums);
  }

  /** Takes the checksum the other device made after `tick`. */
  public putRemoteSum(tick: number, sum: number): void {
    this.compare(tick, sum, this.localSums, this.remoteSums);
  }

  /** Compares a checksum with the other side's, or keeps it for that one. */
  private compare(
    tick: number,
    sum: number,
    others: Map<number, number>,
    own: Map<number, number>
  ): void {
    const other = others.get(tick);
    if (other === undefined) {
      own.set(tick, sum);
      return;
    }
    others.delete(tick);
    if (other !== sum) {
      this.outOfSync = true;
    }
  }

  private driver(seat: number): SeatDriver {
    const inputs = this.inputs[seat];
    return {
      before: (tick) => {
        const input = inputs.get(tick);
        // Played once: what lies behind is no longer needed.
        inputs.delete(tick);
        // The ticks before the first inputs change nothing.
        return input ?? NO_INPUT;
      },
    };
  }
}

/** An input as the engine plays it. */
function played({ steer, drag, boost }: TickInput): GhostInputs {
  return {
    boost,
    drag: drag === null ? null : { x: drag[0], y: drag[1] },
    steer: { x: steer[0], y: steer[1] },
    // Online plays plain: no seat carries a weapon.
    weapon: false,
  };
}
