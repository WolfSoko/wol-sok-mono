import { waveGeometry } from '../wave-model';
import { fakeWebGl2 } from './fake-webgl2.mock';
import { WaveShaderError, WebGlWaveRenderer } from './webgl-wave-renderer';

const look = { dotSize: 2, color: { r: 255, g: 0, b: 51 } };

function setUp(options: Parameters<typeof fakeWebGl2>[0] = {}) {
  const { gl, uniformValues, loseContext } = fakeWebGl2(options);
  const canvas = document.createElement('canvas');
  const onContextLost = jest.fn();
  const onDispose = jest.fn();
  const create = () =>
    new WebGlWaveRenderer(canvas, gl, look, { onContextLost, onDispose });
  return {
    gl,
    uniformValues,
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
    create().resize(waveGeometry(300, 100, { dotSpacing: 20 }), 2);
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
    expect(uniformValues.get('u_wave')).toEqual([0.5]);
    expect(uniformValues.get('u_dots')).toEqual([0.75]);
    expect(uniformValues.get('u_pixelRatio')).toEqual([1.5]);
    expect(uniformValues.get('u_size')).toEqual([300, 100]);
    expect(uniformValues.get('u_color')).toEqual([1, 0, 0.2]);
    const [front] = uniformValues.get('u_frontRadius') ?? [];
    const [echo] = uniformValues.get('u_echoRadius') ?? [];
    expect(echo).toBeLessThan(front);
  });

  it('only clears once the dots faded out', () => {
    const { create, gl } = setUp();
    const renderer = create();
    renderer.resize(waveGeometry(300, 100, { dotSpacing: 20 }), 1);
    renderer.draw({ elapsedMs: 0, wave: 0, dots: 0 });
    expect(gl.clear).toHaveBeenCalled();
    expect(gl.drawArrays).not.toHaveBeenCalled();
  });

  it('reports a lost context and draws no more', () => {
    const { create, gl, canvas, onContextLost } = setUp();
    const renderer = create();
    renderer.resize(waveGeometry(300, 100, { dotSpacing: 20 }), 1);
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
});
