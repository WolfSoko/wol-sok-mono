import type { AfterLoading } from './loading-wave-options';
import type { WaveFrame } from './renderer';

/** how long the wave and the dots take to fade in or out */
export const FADE_MS = 400;

export interface TimelineFrame {
  readonly frame: WaveFrame;
  /** frames stay the same from now on until loading changes again */
  readonly settled: boolean;
  /** `'hide'` faded out completely: the effect can go */
  readonly finished: boolean;
}

interface Fade {
  readonly from: number;
  readonly to: number;
  readonly startedAt: number;
}

const fadeValue = ({ from, to, startedAt }: Fade, now: number): number =>
  from + (to - from) * Math.min(1, Math.max(0, (now - startedAt) / FADE_MS));

const fadeDone = (fade: Fade, now: number): boolean =>
  now - fade.startedAt >= FADE_MS;

/**
 * What the effect shows over time, as loading starts and stops: the wave
 * sweeps from the left edge each time loading starts; wave and dots fade in
 * and out over `FADE_MS`, starting from where they are. Without motion
 * (`prefers-reduced-motion`) the wave never shows.
 */
export class WaveTimeline {
  private loading = false;
  private sweepStartedAt = 0;
  private wave: Fade = { from: 0, to: 0, startedAt: Number.NEGATIVE_INFINITY };
  private dots: Fade;

  /**
   * @param restingDots opacity the dots start with before loading: 1 to show
   * the dots `'keep'` left, say after the options changed
   */
  public constructor(
    private readonly afterLoading: AfterLoading,
    private readonly motion: boolean,
    restingDots = 0
  ) {
    this.dots = {
      from: restingDots,
      to: restingDots,
      startedAt: Number.NEGATIVE_INFINITY,
    };
  }

  public start(now: number): void {
    if (this.loading) {
      return;
    }
    this.loading = true;
    this.sweepStartedAt = now;
    this.wave = { from: 0, to: this.motion ? 1 : 0, startedAt: now };
    this.dots = { from: fadeValue(this.dots, now), to: 1, startedAt: now };
  }

  public stop(now: number): void {
    if (!this.loading) {
      return;
    }
    this.loading = false;
    this.wave = { from: fadeValue(this.wave, now), to: 0, startedAt: now };
    this.dots = {
      from: fadeValue(this.dots, now),
      to: this.afterLoading === 'keep' ? 1 : 0,
      startedAt: now,
    };
  }

  public frameAt(now: number): TimelineFrame {
    const wave = fadeValue(this.wave, now);
    const dots = fadeValue(this.dots, now);
    const fadesDone = fadeDone(this.wave, now) && fadeDone(this.dots, now);
    const waveMoves = this.loading && this.motion;
    return {
      frame: { elapsedMs: now - this.sweepStartedAt, wave, dots },
      settled: fadesDone && !waveMoves,
      finished: fadesDone && !this.loading && dots === 0,
    };
  }
}
