import { TICK_MS } from './fixed-tick';

/** The rate the game is painted at - one frame per tick. */
const TARGET_FRAME_MS = TICK_MS;
/**
 * How much faster than the target a display may run before frames are left
 * out: a 90 Hz one still runs the game on every frame, a 120 Hz one on every
 * second.
 */
const SLACK_MS = 4;
/** Gaps longer than this are hiccups or a hidden tab, not the display rate. */
const MAX_DISPLAY_GAP_MS = 50;
/** How quickly the estimate of the display rate follows the frames. */
const SMOOTHING = 0.1;

/**
 * Picks the display frames the game runs on: each one on a 60 Hz screen, and
 * evenly every second or third one on a faster screen.
 *
 * A 120 Hz phone would otherwise run the whole war and repaint the arena
 * twice as often - for bacteria that only ever move whole cells. Every frame
 * the game does run on is a display frame, so it is never shown twice or
 * skipped the way a timer that runs beside the display would.
 */
export class FramePacer {
  /** The estimated time between two display frames. */
  private displayFrameMs = TARGET_FRAME_MS;
  private lastFrame: number | null = null;
  private lastTick: number | null = null;

  /**
   * Takes the timestamp of a display frame. Returns the milliseconds since
   * the last frame the game ran on when it runs on this one, otherwise null.
   * The first frame only starts the clock.
   */
  public frame(now: number): number | null {
    if (this.lastFrame != null) {
      const gap = now - this.lastFrame;
      if (gap > 0 && gap < MAX_DISPLAY_GAP_MS) {
        this.displayFrameMs += (gap - this.displayFrameMs) * SMOOTHING;
      }
    }
    this.lastFrame = now;
    if (this.lastTick == null) {
      this.lastTick = now;
      return null;
    }
    const every = Math.max(
      1,
      Math.floor((TARGET_FRAME_MS + SLACK_MS) / this.displayFrameMs)
    );
    // Half a frame early is still on time - the timestamps jitter.
    const due = (every - 0.5) * this.displayFrameMs;
    const elapsed = now - this.lastTick;
    if (elapsed < due) {
      return null;
    }
    this.lastTick = now;
    return elapsed;
  }
}
