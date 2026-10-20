import { clamp } from './geometry';

/**
 * How often the war advances, on every display: each tick is one step of
 * the simulation, the bot and the crosshairs, all of the same length. Two
 * machines given the same seed and the same inputs therefore play the same
 * match, which the replays rely on.
 *
 * The balance is tuned to this rate: combat, jitter and moves happen once
 * per step, and at 30 ticks a match against the computer took up to twice
 * as long.
 */
export const TICKS_PER_SEC = 60;
export const TICK_SEC = 1 / TICKS_PER_SEC;
export const TICK_MS = 1000 / TICKS_PER_SEC;

/**
 * The milliseconds of whole ticks - exact on every second, where adding
 * {@link TICK_MS} up would leave 60 ticks a hair short of 1000.
 */
export function ticksToMs(ticks: number): number {
  return (ticks * 1000) / TICKS_PER_SEC;
}

/**
 * How close to a tick the clock may be and still run it. Display frames
 * jitter by a millisecond or so; without the slack a 60 Hz display would
 * now and then run no tick on one frame and two on the next.
 */
const SLACK_MS = 2;

/**
 * A timer `bySec` further down. What whole ticks leave of a timer set to a
 * whole number of ticks is float residue, and counts as run out - a 0.3
 * second timer runs out after 18 ticks, not 19.
 */
export function countDown(sec: number, bySec = TICK_SEC): number {
  const left = sec - bySec;
  return left > 1e-9 ? left : 0;
}

/** What one display frame of a running match brings. */
export interface GameFrame {
  /** Whole ticks to run on this frame - often 0 on a fast display. */
  ticks: number;
  /**
   * How far the clock stands between the last tick and the next one, from 0
   * to 1 - the crosshairs are drawn that far ahead along their last step.
   */
  alpha: number;
  /** Seconds since the last frame, for what only moves on screen. */
  elapsedSec: number;
}

/**
 * Turns the measured time between display frames into whole ticks. What is
 * left over is carried to the next frame, so in the long run the match
 * advances exactly as fast as the clock on the wall.
 */
export class TickClock {
  private carryMs = 0;

  public advance(elapsedMs: number): GameFrame {
    this.carryMs += elapsedMs;
    const ticks = Math.floor((this.carryMs + SLACK_MS) / TICK_MS);
    this.carryMs -= ticks * TICK_MS;
    return {
      ticks,
      alpha: clamp(this.carryMs / TICK_MS, 0, 1),
      elapsedSec: elapsedMs / 1000,
    };
  }
}

/** Seconds as the match clock shows them, "1:05". */
export function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
