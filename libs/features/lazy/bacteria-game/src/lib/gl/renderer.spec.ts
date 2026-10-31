import { isSoftwareRenderer, webGlRenderer } from './renderer';

describe('isSoftwareRenderer', () => {
  it('tells the software renderers', () => {
    for (const renderer of [
      'Google SwiftShader',
      'llvmpipe (LLVM 15.0.7, 256 bits)',
      'softpipe',
      'ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0)',
    ]) {
      expect(isSoftwareRenderer(renderer)).toBe(true);
    }
    for (const renderer of [
      'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0)',
      'Apple GPU',
      'Mali-G78',
    ]) {
      expect(isSoftwareRenderer(renderer)).toBe(false);
    }
  });
});

describe('webGlRenderer', () => {
  afterEach(() => jest.restoreAllMocks());

  /** A throwaway canvas whose WebGL2 context renders with `renderer`. */
  function throwawayCanvas(renderer: string | null) {
    const loseContext = jest.fn();
    const gl =
      renderer === null
        ? null
        : {
            RENDERER: 0x1f01,
            getExtension: (name: string) =>
              name === 'WEBGL_lose_context' ? { loseContext } : null,
            getParameter: () => renderer,
          };
    const canvas = document.createElement('canvas');
    jest
      .spyOn(canvas, 'getContext')
      .mockReturnValue(gl as unknown as WebGL2RenderingContext);
    jest.spyOn(document, 'createElement').mockReturnValue(canvas);
    return { loseContext };
  }

  it('should name the renderer of a throwaway context and give it back', () => {
    // given
    const { loseContext } = throwawayCanvas('Google SwiftShader');

    // when
    const renderer = webGlRenderer();

    // then
    expect(renderer).toBe('Google SwiftShader');
    expect(loseContext).toHaveBeenCalledTimes(1);
  });

  it('should answer null where the browser has no WebGL2', () => {
    // given
    throwawayCanvas(null);

    // when
    const renderer = webGlRenderer();

    // then
    expect(renderer).toBeNull();
  });
});
