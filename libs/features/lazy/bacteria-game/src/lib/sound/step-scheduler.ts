/** How far ahead steps are handed to the audio clock, in seconds. */
const LOOKAHEAD_SEC = 0.25;
/** How often the scheduler wakes up to hand them over, in milliseconds. */
const TICK_MS = 60;

export interface StepSchedule {
  /** Steps in one pass of the loop. */
  steps: number;
  /** Seconds per step. */
  stepSec: number;
  /** Plays what falls on a step, at that time of the audio clock. */
  play: (step: number, at: number) => void;
  /** Called on every wake-up, before the steps - to steer slow changes. */
  tick?: (now: number) => void;
  /** Called once the loop wraps round to its first step again. */
  wrap?: () => void;
}

/**
 * Walks a loop step by step along the audio clock: it wakes up a few times
 * a second and hands over the steps that fall within the next quarter of a
 * second, so a busy frame on the main thread never makes the music stumble.
 *
 * Throttled in a background tab, it skips what is already late rather than
 * playing a burst of it at once.
 */
/** Sorts what plays in a loop into one list per step. */
export function byStep<T extends { step: number }>(
  steps: number,
  items: readonly T[]
): T[][] {
  const buckets: T[][] = Array.from({ length: steps }, () => []);
  for (const item of items) {
    buckets[item.step].push(item);
  }
  return buckets;
}

export class StepScheduler {
  private timer: ReturnType<typeof setInterval> | null = null;
  /** The step that is scheduled next, and when it plays. */
  private nextStep = 0;
  private nextStepAt = 0;

  public constructor(
    private readonly context: AudioContext,
    private readonly schedule: StepSchedule
  ) {}

  /** Starts `atSec` seconds into the loop, from the next step on. */
  public start(atSec = 0): void {
    this.stop();
    const { steps, stepSec } = this.schedule;
    const now = this.context.currentTime;
    const firstStep = Math.max(0, Math.ceil(atSec / stepSec - 1e-6));
    this.nextStep = firstStep % steps;
    this.nextStepAt = now + 0.05 + (firstStep * stepSec - atSec);
    this.tick();
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  public stop(): void {
    if (this.timer != null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private tick(): void {
    const { steps, stepSec } = this.schedule;
    const now = this.context.currentTime;
    this.schedule.tick?.(now);
    if (this.nextStepAt < now) {
      const behind = Math.ceil((now - this.nextStepAt) / stepSec);
      const wrapped = this.nextStep + behind >= steps;
      this.nextStep = (this.nextStep + behind) % steps;
      this.nextStepAt += behind * stepSec;
      if (wrapped) {
        this.schedule.wrap?.();
      }
    }
    while (this.nextStepAt < now + LOOKAHEAD_SEC) {
      this.schedule.play(this.nextStep, this.nextStepAt);
      this.nextStep = (this.nextStep + 1) % steps;
      this.nextStepAt += stepSec;
      if (this.nextStep === 0) {
        this.schedule.wrap?.();
      }
    }
  }
}
