import { FRAME_PERF_WINDOW_MS, FramePerf } from './frame-perf';

describe('FramePerf', () => {
  it('reports the average per frame once a window is over', () => {
    const perf = new FramePerf();

    expect(perf.record(1000, 4, 2, 1)).toBeNull();
    expect(perf.record(1200, 6, 4, 2)).toBeNull();
    expect(perf.record(1000 + FRAME_PERF_WINDOW_MS, 8, 6, 3)).toEqual({
      simMs: 6,
      drawMs: 4,
      ticks: 2,
      gpuSimMs: null,
      gpuDrawMs: null,
    });
  });

  it('starts the next window where the last one ended', () => {
    const perf = new FramePerf();
    perf.record(0, 1, 1, 1);
    perf.record(FRAME_PERF_WINDOW_MS, 1, 1, 1);

    expect(perf.record(FRAME_PERF_WINDOW_MS + 10, 9, 9, 9)).toBeNull();
    expect(perf.record(2 * FRAME_PERF_WINDOW_MS, 1, 1, 1)?.simMs).toBe(5);
  });

  it("averages the GPU's timings over the ones that came in", () => {
    const perf = new FramePerf();
    perf.recordGpu('sim', 3);
    perf.recordGpu('sim', 5);
    perf.recordGpu('draw', 2);
    perf.record(0, 1, 1, 1);

    const report = perf.record(FRAME_PERF_WINDOW_MS, 1, 1, 1);

    expect(report?.gpuSimMs).toBe(4);
    expect(report?.gpuDrawMs).toBe(2);
  });
});
