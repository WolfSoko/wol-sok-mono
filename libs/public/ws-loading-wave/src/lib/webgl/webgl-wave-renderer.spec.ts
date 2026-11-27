import { waveGeometry } from '../wave-model';
import { fakeWebGl2 } from './fake-webgl2.mock';
import type { LoadingWaveShader } from './loading-wave-shader';
import { STANDARD_UNIFORMS } from './shader-program';
import { ECHO_LAG } from './echo';
import {
  echoRadius,
  WaveShaderError,
  WebGlWaveRenderer,
} from './webgl-wave-renderer';

const look = { dotSize: 2, color: { r: 255, g: 0, b: 51 } };

function setUp(
  options: Parameters<typeof fakeWebGl2>[0] = {},
  shader: LoadingWaveShader = {
    fragment: 'vec4 wsShade(vec2 p) { return vec4(1.0); }',
  }
) {
  const { gl, uniformValues, loseContext, buffer, shaderSources } =
    fakeWebGl2(options);
  const canvas = document.createElement('canvas');
  buffer.canvas = canvas;
  const onContextLost = jest.fn();
  const onDispose = jest.fn();
  const create = () =>
    new WebGlWaveRenderer(canvas, gl, look, shader, {
      onContextLost,
      onDispose,
    });
  return {
    gl,
    buffer,
    uniformValues,
    shaderSources,
    loseContext,
    canvas,
    onContextLost,
    onDispose,
    create,
  };
}

describe('WebGlWaveRenderer', () => {
  it('asks for a context the browser refuses without a real GPU', () => {
    const canvas = document.createElement('canvas');
    const getContext = jest.spyOn(canvas, 'getContext').mockReturnValue(null);
    expect(WebGlWaveRenderer.createContext(canvas)).toBeNull();
    expect(getContext).toHaveBeenCalledWith(
      'webgl2',
      expect.objectContaining({ failIfMajorPerformanceCaveat: true })
    );
  });

  it('throws a WaveShaderError when a shader does not compile', () => {
    const { create, gl } = setUp({ compiles: false });
    expect(create).toThrow(WaveShaderError);
    expect(gl.deleteShader).toHaveBeenCalled();
  });

  it('throws a WaveShaderError when the program does not link', () => {
    const { create, gl } = setUp({ links: false });
    expect(create).toThrow(WaveShaderError);
    expect(gl.deleteProgram).toHaveBeenCalled();
  });

  it('sizes canvas and viewport by the pixel ratio', () => {
    const { create, canvas, gl } = setUp();
    create().resize(
      waveGeometry(300, 100, { dotSpacing: 20, sweepMs: 1000 }),
      2
    );
    expect([canvas.width, canvas.height]).toEqual([600, 200]);
    expect(gl.viewport).toHaveBeenCalledWith(0, 0, 600, 200);
  });

  it('draws one full-canvas triangle with the frame and the look as uniforms', () => {
    const { create, gl, uniformValues } = setUp();
    const renderer = create();
    const geometry = waveGeometry(300, 100, { dotSpacing: 20, sweepMs: 900 });
    renderer.resize(geometry, 1.5);
    renderer.draw({ elapsedMs: 300, wave: 0.5, dots: 0.75 });
    expect(gl.drawArrays).toHaveBeenCalledWith(gl.TRIANGLES, 0, 3);
    expect(uniformValues.get('ws_wave')).toEqual([0.5]);
    expect(uniformValues.get('ws_dots')).toEqual([0.75]);
    expect(uniformValues.get('ws_bufferSize')).toEqual([450, 150]);
    expect(uniformValues.get('ws_size')).toEqual([300, 100]);
    expect(uniformValues.get('ws_color')).toEqual([1, 0, 0.2, 1]);
    // unset, the accent is the dots' colour
    expect(uniformValues.get('ws_accent')).toEqual([1, 0, 0.2, 1]);
    const [front] = uniformValues.get('ws_frontRadius') ?? [];
    const [echo] = uniformValues.get('ws_echoRadius') ?? [];
    expect(echo).toBeLessThan(front);
    // the first sweep: no afterglow ahead of the front
    expect(uniformValues.get('ws_previousSweep')).toEqual([0]);
  });

  it('shows no echo before the front ran ahead by its lag', () => {
    const geometry = waveGeometry(300, 100, { dotSpacing: 20, sweepMs: 900 });
    expect(echoRadius(geometry, ECHO_LAG * 900 - 1)).toBeLessThan(0);
    expect(echoRadius(geometry, ECHO_LAG * 900)).toBe(geometry.startRadius);
  });

  it('maps a smaller drawing buffer than asked for onto the whole host', () => {
    const { create, gl, buffer, uniformValues } = setUp();
    buffer.maxSize = 4096;
    const renderer = create();
    renderer.resize(
      waveGeometry(400, 8000, { dotSpacing: 20, sweepMs: 1000 }),
      1
    );
    renderer.draw({ elapsedMs: 0, wave: 1, dots: 1 });
    expect(gl.viewport).toHaveBeenCalledWith(0, 0, 400, 4096);
    expect(uniformValues.get('ws_bufferSize')).toEqual([400, 4096]);
    expect(uniformValues.get('ws_size')).toEqual([400, 8000]);
  });

  it('only clears once the dots faded out', () => {
    const { create, gl } = setUp();
    const renderer = create();
    renderer.resize(
      waveGeometry(300, 100, { dotSpacing: 20, sweepMs: 1000 }),
      1
    );
    renderer.draw({ elapsedMs: 0, wave: 0, dots: 0 });
    expect(gl.clear).toHaveBeenCalled();
    expect(gl.drawArrays).not.toHaveBeenCalled();
  });

  it('reports a lost context and draws no more', () => {
    const { create, gl, canvas, onContextLost } = setUp();
    const renderer = create();
    renderer.resize(
      waveGeometry(300, 100, { dotSpacing: 20, sweepMs: 1000 }),
      1
    );
    const event = new Event('webglcontextlost', { cancelable: true });
    canvas.dispatchEvent(event);
    expect(onContextLost).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
    renderer.draw({ elapsedMs: 0, wave: 1, dots: 1 });
    expect(gl.drawArrays).not.toHaveBeenCalled();
  });

  it('frees program and context on dispose, once', () => {
    const { create, gl, loseContext, onDispose, canvas, onContextLost } =
      setUp();
    const renderer = create();
    renderer.dispose();
    renderer.dispose();
    expect(gl.deleteProgram).toHaveBeenCalledTimes(1);
    expect(loseContext).toHaveBeenCalledTimes(1);
    expect(onDispose).toHaveBeenCalledTimes(1);
    canvas.dispatchEvent(new Event('webglcontextlost'));
    expect(onContextLost).not.toHaveBeenCalled();
  });

  describe('shader contract', () => {
    const shader: LoadingWaveShader = {
      fragment:
        'uniform float u_glow;\nvec4 wsShade(vec2 p) { return vec4(u_glow); }',
      uniforms: { u_glow: 0.5, u_tint: [0.1, 0.2, 0.3] },
    };

    it('compiles the header, the fragment and main, in this order', () => {
      const { create, shaderSources } = setUp({}, shader);
      create();
      const fragment = shaderSources.find((source) =>
        source.includes('wsShade')
      );
      const at = (text: string) => fragment?.indexOf(text) ?? -1;
      expect(
        fragment?.startsWith('#version 300 es\nprecision highp float;')
      ).toBe(true);
      expect(at('uniform float ws_wave;')).toBeGreaterThan(0);
      expect(at('float ws_dotDisk(')).toBeGreaterThan(
        at('uniform float ws_wave;')
      );
      // the GPU's log counts the shader's own lines from its first
      expect(at('#line 1\nuniform float u_glow;')).toBeGreaterThan(
        at('float ws_dotDisk(')
      );
      expect(at('void main()')).toBeGreaterThan(at('uniform float u_glow;'));
      expect(at('wsShade(point)')).toBeGreaterThan(at('void main()'));
    });

    it("sets the shader's own uniforms each frame by their size", () => {
      const { create, uniformValues, gl } = setUp({}, shader);
      const renderer = create();
      renderer.resize(
        waveGeometry(300, 100, { dotSpacing: 20, sweepMs: 1000 }),
        1
      );
      renderer.draw({ elapsedMs: 0, wave: 1, dots: 1 });
      expect(uniformValues.get('u_glow')).toEqual([0.5]);
      expect(uniformValues.get('u_tint')).toEqual([0.1, 0.2, 0.3]);
      renderer.setShaderUniforms({ u_glow: 0.9 });
      renderer.draw({ elapsedMs: 16, wave: 1, dots: 1 });
      expect(uniformValues.get('u_glow')).toEqual([0.9]);
      // the ws_ uniforms are the lib's own
      renderer.setShaderUniforms({ ws_wave: 0.123 });
      renderer.draw({ elapsedMs: 32, wave: 1, dots: 1 });
      expect(uniformValues.get('ws_wave')).toEqual([1]);
      // each name is looked up once
      const lookups = gl.getUniformLocation.mock.calls.filter(
        ([, name]) => name === 'u_glow'
      );
      expect(lookups).toHaveLength(1);
    });

    it('sets every standard uniform each frame', () => {
      const { create, uniformValues } = setUp({}, shader);
      const renderer = create();
      renderer.resize(
        waveGeometry(300, 100, { dotSpacing: 20, sweepMs: 1000 }),
        1
      );
      renderer.draw({ elapsedMs: 0, wave: 1, dots: 1 });
      for (const name of STANDARD_UNIFORMS) {
        expect([name, uniformValues.has(name)]).toEqual([name, true]);
      }
      expect(uniformValues.get('ws_spacing')).toEqual([20]);
      expect(uniformValues.get('ws_dotSize')).toEqual([2]);
    });

    it('gives time, phase and pixel size, and the accent where the look has one', () => {
      const { gl, canvas, buffer, uniformValues } = setUp();
      buffer.canvas = canvas;
      const renderer = new WebGlWaveRenderer(
        canvas,
        gl,
        { ...look, accent: { r: 0, g: 255, b: 0, alpha: 0.5 } },
        shader,
        { onContextLost: jest.fn() }
      );
      renderer.resize(
        waveGeometry(300, 100, { dotSpacing: 20, sweepMs: 1000 }),
        2
      );
      renderer.draw({ elapsedMs: 2250, wave: 1, dots: 1 });
      expect(uniformValues.get('ws_time')).toEqual([2.25]);
      expect(uniformValues.get('ws_phase')?.[0]).toBeCloseTo(0.25, 9);
      expect(uniformValues.get('ws_pixel')).toEqual([0.5]);
      expect(uniformValues.get('ws_accent')).toEqual([0, 1, 0, 0.5]);
    });

    it('draws a shader that fades its own colour, as long as the dots show', () => {
      const { create, gl } = setUp();
      const renderer = create();
      renderer.resize(
        waveGeometry(300, 100, { dotSpacing: 20, sweepMs: 1000 }),
        1
      );
      renderer.draw({ elapsedMs: 0, wave: 0, dots: 0.1 });
      expect(gl.drawArrays).toHaveBeenCalled();
    });
  });
});
