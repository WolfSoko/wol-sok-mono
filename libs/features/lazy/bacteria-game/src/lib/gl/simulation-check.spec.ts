import { gpuTrusted, simulationCheckLines } from './simulation-check';

describe('simulationCheckLines', () => {
  it('says a device that passed plays on the GPU, and on which one', () => {
    expect(
      simulationCheckLines({ ok: true, renderer: 'Adreno 650' }, null)
    ).toEqual([
      { key: 'settings.simulation.gpuInt' },
      {
        key: 'settings.simulation.passed',
        params: { renderer: 'Adreno 650' },
      },
    ]);
  });

  it('keeps a software renderer on the CPU, and says why', () => {
    const renderer =
      'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)';
    expect(simulationCheckLines({ ok: true, renderer }, null)).toEqual([
      { key: 'settings.simulation.cpu' },
      { key: 'settings.simulation.software', params: { renderer } },
    ]);
  });

  it('says where the self-test failed, and that matches play on the CPU', () => {
    expect(
      simulationCheckLines(
        { ok: false, firstBadTick: 4, renderer: 'Mali-G78' },
        null
      )
    ).toEqual([
      { key: 'settings.simulation.cpu' },
      {
        key: 'settings.simulation.failedAt',
        params: { renderer: 'Mali-G78', tick: 4 },
      },
    ]);
  });

  it('names an error that kept the test from running', () => {
    expect(
      simulationCheckLines(
        { ok: false, renderer: 'none', error: 'no WebGL2 context' },
        null
      )
    ).toContainEqual({
      key: 'settings.simulation.error',
      params: { renderer: 'none', error: 'no WebGL2 context' },
    });
  });

  it('follows an override, and says so', () => {
    expect(simulationCheckLines(null, 'gpu-int')).toEqual([
      { key: 'settings.simulation.gpuInt' },
      { key: 'settings.simulation.forced', params: { ruleset: 'gpu-int' } },
      { key: 'settings.simulation.pending' },
    ]);
    expect(
      simulationCheckLines({ ok: true, renderer: 'Adreno 650' }, 'cpu')[0]
    ).toEqual({ key: 'settings.simulation.cpu' });
  });
});

describe('gpuTrusted', () => {
  it('trusts a GPU that passed, on hardware only', () => {
    expect(gpuTrusted({ ok: true, renderer: 'Adreno 650' })).toBe(true);
    expect(gpuTrusted({ ok: false, renderer: 'Adreno 650' })).toBe(false);
    expect(gpuTrusted(null)).toBe(false);
    expect(
      gpuTrusted({ ok: true, renderer: 'llvmpipe (LLVM 15.0.7, 256 bits)' })
    ).toBe(false);
  });
});
