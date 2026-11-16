/** How long the HUD's breakdown averages the frames over, in milliseconds. */
export const FRAME_PERF_WINDOW_MS = 500;

/** Where a frame's time went, averaged per frame over a window. */
export interface FramePerfReport {
  /** Main-thread milliseconds running the ticks. */
  simMs: number;
  /** Main-thread milliseconds painting. */
  drawMs: number;
  /** Ticks run per frame. */
  ticks: number;
  /** GPU milliseconds the ticks took - null where the GPU is not timed. */
  gpuSimMs: number | null;
  /** GPU milliseconds the painting took - null where the GPU is not timed. */
  gpuDrawMs: number | null;
}

/** What a GPU timing measures. */
export type GpuSlot = 'sim' | 'draw';

/**
 * Adds up where the frames of a match spend their time and reports the
 * average per frame once a window is over - the breakdown the HUD shows
 * beside the frame rate, to tell a slow device's bottleneck.
 */
export class FramePerf {
  private windowStart: number | null = null;
  private frames = 0;
  private simMs = 0;
  private drawMs = 0;
  private ticks = 0;
  private readonly gpu = {
    sim: { ms: 0, count: 0 },
    draw: { ms: 0, count: 0 },
  };

  /** Takes a GPU timing, which comes in a few frames after its frame. */
  public recordGpu(slot: GpuSlot, ms: number): void {
    this.gpu[slot].ms += ms;
    this.gpu[slot].count++;
  }

  /**
   * Takes a frame. Returns the averages once the window is over, null
   * before.
   */
  public record(
    now: number,
    simMs: number,
    drawMs: number,
    ticks: number
  ): FramePerfReport | null {
    this.windowStart ??= now;
    this.frames++;
    this.simMs += simMs;
    this.drawMs += drawMs;
    this.ticks += ticks;
    if (now - this.windowStart < FRAME_PERF_WINDOW_MS) {
      return null;
    }
    const perFrame = (value: number) => value / this.frames;
    const gpu = (slot: GpuSlot) =>
      this.gpu[slot].count === 0
        ? null
        : this.gpu[slot].ms / this.gpu[slot].count;
    const report: FramePerfReport = {
      simMs: perFrame(this.simMs),
      drawMs: perFrame(this.drawMs),
      ticks: perFrame(this.ticks),
      gpuSimMs: gpu('sim'),
      gpuDrawMs: gpu('draw'),
    };
    this.reset();
    this.windowStart = now;
    return report;
  }

  /** Starts over, as a new match does. */
  public reset(): void {
    this.windowStart = null;
    this.frames = 0;
    this.simMs = 0;
    this.drawMs = 0;
    this.ticks = 0;
    for (const slot of [this.gpu.sim, this.gpu.draw]) {
      slot.ms = 0;
      slot.count = 0;
    }
  }
}
