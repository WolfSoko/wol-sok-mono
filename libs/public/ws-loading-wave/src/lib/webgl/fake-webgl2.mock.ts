export interface FakeWebGl2Options {
  readonly compiles?: boolean;
  readonly links?: boolean;
}

/** a WebGL2 context that records uniforms and calls, for specs */
export function fakeWebGl2({
  compiles = true,
  links = true,
}: FakeWebGl2Options = {}) {
  const uniformValues = new Map<string, number[]>();
  const shaderSources: string[] = [];
  const loseContext = jest.fn();
  let lost = false;
  const setUniform = (location: { name: string } | null, ...values: number[]) =>
    location && uniformValues.set(location.name, values);
  /** the GPU gives the canvas the buffer it asks for, up to `maxBuffer` */
  const buffer = {
    canvas: null as HTMLCanvasElement | null,
    maxSize: Number.POSITIVE_INFINITY,
  };
  const gl = {
    get drawingBufferWidth(): number {
      return Math.min(buffer.canvas?.width ?? 0, buffer.maxSize);
    },
    get drawingBufferHeight(): number {
      return Math.min(buffer.canvas?.height ?? 0, buffer.maxSize);
    },
    VERTEX_SHADER: 1,
    FRAGMENT_SHADER: 2,
    COMPILE_STATUS: 3,
    LINK_STATUS: 4,
    COLOR_BUFFER_BIT: 5,
    TRIANGLES: 6,
    createShader: jest.fn(() => ({})),
    shaderSource: jest.fn((_shader: unknown, source: string) =>
      shaderSources.push(source)
    ),
    compileShader: jest.fn(),
    getShaderParameter: jest.fn(() => compiles),
    getShaderInfoLog: jest.fn(() => 'compile log'),
    deleteShader: jest.fn(),
    createProgram: jest.fn(() => ({})),
    attachShader: jest.fn(),
    linkProgram: jest.fn(),
    getProgramParameter: jest.fn(() => links),
    getProgramInfoLog: jest.fn(() => 'link log'),
    deleteProgram: jest.fn(),
    getUniformLocation: jest.fn((_program: unknown, name: string) => ({
      name,
    })),
    useProgram: jest.fn(),
    viewport: jest.fn(),
    clearColor: jest.fn(),
    clear: jest.fn(),
    drawArrays: jest.fn(),
    uniform1f: jest.fn(setUniform),
    uniform2f: jest.fn(setUniform),
    uniform3f: jest.fn(setUniform),
    uniform4f: jest.fn(setUniform),
    isContextLost: jest.fn(() => lost),
    getExtension: jest.fn((name: string) =>
      name === 'WEBGL_lose_context'
        ? {
            loseContext: () => {
              lost = true;
              loseContext();
            },
          }
        : null
    ),
  };
  return {
    gl: gl as typeof gl & WebGL2RenderingContext,
    buffer,
    uniformValues,
    shaderSources,
    loseContext,
  };
}
