import type { LoadingWaveShader } from './lib/webgl/loading-wave-shader';
import * as builtIn from './shaders';

const shaders = Object.entries(builtIn) as [string, LoadingWaveShader][];

describe('@wolsok/loading-wave/shaders', () => {
  it('exports the built-in shaders beside the default', () => {
    expect(shaders.map(([name]) => name).sort()).toEqual([
      'circuitTracesShader',
    ]);
  });

  describe.each(shaders)('%s', (_name, shader) => {
    it('defines wsShade and leaves version, uniforms and main to the lib', () => {
      expect(shader.fragment).toMatch(/\bvec4 wsShade\(vec2 point\)/);
      expect(shader.fragment).not.toMatch(/#version|\bvoid main\b/);
      expect(shader.fragment).not.toMatch(/\buniform\b[^;]*\bws_/);
    });

    it('is a plain literal, so a bundler can drop it when unused', () => {
      expect(shader.fragment).not.toContain('${');
    });
  });
});
