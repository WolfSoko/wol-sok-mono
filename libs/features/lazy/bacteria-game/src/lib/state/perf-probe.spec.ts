import { PERF_PROBE_KEY, perfProbeOf } from './perf-probe';

describe('perfProbeOf', () => {
  it('should find no probe where no spec put one', () => {
    expect(perfProbeOf({})).toBeNull();
  });

  it('should ignore something else under the key', () => {
    expect(perfProbeOf({ [PERF_PROBE_KEY]: true })).toBeNull();
    expect(perfProbeOf({ [PERF_PROBE_KEY]: { tickMs: 1 } })).toBeNull();
  });

  it('should hand back the probe a spec put there', () => {
    const probe = { tickMs: [] };

    expect(perfProbeOf({ [PERF_PROBE_KEY]: probe })).toBe(probe);
  });
});
