/**
 * The fractions of the canvas's pixels a frame may be painted with, finest
 * first - the copy onto the canvas scales the frame up to it.
 */
export const RENDER_SCALES = [1, 0.85, 0.7, 0.55] as const;

/** How long a measurement runs, in milliseconds. */
export const QUALITY_WINDOW_MS = 1000;
/** Below this many frames a second a measurement counts as slow. */
const SLOW_FPS = 48;
/** At or above this many frames a second a measurement counts as smooth. */
const SMOOTH_FPS = 57;
/**
 * The share of a slow frame the main thread must spend waiting - on the
 * GPU, the compositor or the display - for fewer pixels to be worth it: a
 * frame the war's ticks fill is no faster with them. A display held to 30
 * frames a second (a phone saving power) looks the same as a busy GPU, and
 * gets fewer pixels too - which cost little there and save power.
 */
const WAIT_SHARE = 0.3;
/** How many slow measurements in a row take the scale down a step. */
export const SLOW_WINDOWS = 2;
/** How many smooth measurements in a row take it up a step again. */
export const SMOOTH_WINDOWS = 5;
/**
 * A frame longer than this is a pause, not a slow frame: it starts over. A
 * paused match shows no frames for seconds; a slow one shows a few a second.
 */
const GAP_MS = 1000;

/**
 * Picks how many of the canvas's pixels the arena is painted with, from
 * how fast the frames come and what holds them back. A match starts where
 * the last one on that arena ended. Slow seconds spent waiting take it a
 * step down. Smooth seconds take it back up, but only until the match's
 * first step down: from then on it goes down only, so it never swings to
 * and fro.
 *
 * Whether a step paid is not asked: the war grows fast as a match starts,
 * and a second's frame rate varies by a tenth - more than a step gains.
 */
export class AdaptiveQuality {
  private step = 0;
  /** The finest step the match may still go up to. */
  private ceiling = 0;
  private windowStart: number | null = null;
  private lastFrame: number | null = null;
  private frames = 0;
  /** Milliseconds the window's frames waited, beyond their own work. */
  private waited = 0;
  private slow = 0;
  private smooth = 0;

  /** The fraction of the canvas's pixels to paint the arena with. */
  public get scale(): number {
    return RENDER_SCALES[this.step];
  }

  /** Starts a match at that scale - one of {@link RENDER_SCALES}. */
  public start(scale: number): void {
    const step = RENDER_SCALES.findIndex((value) => value === scale);
    this.step = Math.max(0, step);
    this.ceiling = 0;
    this.forget();
  }

  /** Forgets the frames so far. */
  private forget(): void {
    this.windowStart = null;
    this.lastFrame = null;
    this.frames = 0;
    this.waited = 0;
    this.slow = 0;
    this.smooth = 0;
  }

  /**
   * Takes a frame shown at `now`, whose ticks and painting kept the main
   * thread busy for `busyMs`, both in milliseconds. Returns the new scale
   * when it changes, null otherwise.
   */
  public frame(now: number, busyMs: number): number | null {
    const last = this.lastFrame;
    this.lastFrame = now;
    if (last === null || now - last > GAP_MS) {
      // A pause: what came before it does not count with what comes after.
      this.forget();
      this.lastFrame = now;
      return null;
    }
    this.windowStart ??= last;
    this.frames++;
    this.waited += Math.max(0, now - last - busyMs);
    const elapsed = now - this.windowStart;
    if (elapsed < QUALITY_WINDOW_MS) {
      return null;
    }
    const fps = (this.frames * 1000) / elapsed;
    const wait = this.waited / this.frames;
    this.windowStart = now;
    this.frames = 0;
    this.waited = 0;
    return this.measured(fps, wait);
  }

  private measured(fps: number, wait: number): number | null {
    const waiting = wait >= (WAIT_SHARE * 1000) / fps;
    this.slow = fps < SLOW_FPS && waiting ? this.slow + 1 : 0;
    this.smooth = fps >= SMOOTH_FPS ? this.smooth + 1 : 0;
    if (this.slow >= SLOW_WINDOWS && this.step < RENDER_SCALES.length - 1) {
      this.step++;
      this.ceiling = this.step;
      return this.changed();
    }
    if (this.smooth >= SMOOTH_WINDOWS && this.step > this.ceiling) {
      this.step--;
      return this.changed();
    }
    return null;
  }

  private changed(): number {
    this.slow = 0;
    this.smooth = 0;
    return this.scale;
  }
}
