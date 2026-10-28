import type { GpuSlot } from '../arena/frame-perf';

/** Timings asked of the GPU and not read yet, at the most. */
const MAX_PENDING = 16;

/**
 * Times what the GPU spends on the commands between `begin` and `end`,
 * through `EXT_disjoint_timer_query_webgl2` - for the HUD's breakdown of
 * a frame. The GPU answers a few frames late, so `poll` hands over each
 * timing once it is there. Null where the browser does not offer the
 * extension; a timing taken while the GPU was disjoint (it changed clocks,
 * or another context ran) is dropped.
 */
export class GpuTimer {
  private readonly free: WebGLQuery[] = [];
  private readonly pending: { query: WebGLQuery; slot: GpuSlot }[] = [];
  private running: { query: WebGLQuery; slot: GpuSlot } | null = null;

  private constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly ext: {
      TIME_ELAPSED_EXT: number;
      GPU_DISJOINT_EXT: number;
    }
  ) {}

  public static create(gl: WebGL2RenderingContext): GpuTimer | null {
    const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2') as {
      TIME_ELAPSED_EXT: number;
      GPU_DISJOINT_EXT: number;
    } | null;
    return ext === null ? null : new GpuTimer(gl, ext);
  }

  /** Starts timing - unless a timing runs, or too many wait to be read. */
  public begin(slot: GpuSlot): void {
    if (this.running !== null || this.pending.length >= MAX_PENDING) {
      return;
    }
    const query = this.free.pop() ?? this.gl.createQuery();
    if (query === null) {
      return;
    }
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, query);
    this.running = { query, slot };
  }

  public end(): void {
    if (this.running === null) {
      return;
    }
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.pending.push(this.running);
    this.running = null;
  }

  /** Hands over each timing the GPU has answered, oldest first, in ms. */
  public poll(take: (slot: GpuSlot, ms: number) => void): void {
    const gl = this.gl;
    // A disjoint GPU spoils every timing in flight, finished or not.
    if (gl.getParameter(this.ext.GPU_DISJOINT_EXT) === true) {
      for (const { query } of this.pending) {
        this.free.push(query);
      }
      this.pending.length = 0;
      return;
    }
    while (this.pending.length > 0) {
      const { query, slot } = this.pending[0];
      if (gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE) !== true) {
        return;
      }
      const ns: number = gl.getQueryParameter(query, gl.QUERY_RESULT);
      this.pending.shift();
      this.free.push(query);
      take(slot, ns / 1e6);
    }
  }

  /** Lets go of the queries. */
  public dispose(): void {
    this.end();
    for (const { query } of this.pending) {
      this.gl.deleteQuery(query);
    }
    for (const query of this.free) {
      this.gl.deleteQuery(query);
    }
    this.pending.length = 0;
    this.free.length = 0;
  }
}
