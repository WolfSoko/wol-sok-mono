import {
  chooseWaveRenderer,
  ChooseWaveRendererParams,
  GpuContextBudget,
} from './choose-wave-renderer';
import { fakeWebGl2, FakeWebGl2Options } from './webgl/fake-webgl2.mock';

const look = { dotSize: 1.5, color: { r: 1, g: 2, b: 3 } };

/** canvases that offer the given WebGL2 context (or none) and a 2D one */
function canvases(webgl2: FakeWebGl2Options | 'none') {
  const contextTypes: string[] = [];
  const fake = webgl2 === 'none' ? null : fakeWebGl2(webgl2);
  const createCanvas = jest.fn(() => {
    const canvas = document.createElement('canvas');
    jest.spyOn(canvas, 'getContext').mockImplementation((type: string) => {
      contextTypes.push(type);
      return type === 'webgl2'
        ? (fake?.gl ?? null)
        : ({} as CanvasRenderingContext2D);
    });
    return canvas;
  });
  return { createCanvas, contextTypes, fake };
}

function choose(
  webgl2: FakeWebGl2Options | 'none',
  params: Partial<ChooseWaveRendererParams> = {}
) {
  const setup = canvases(webgl2);
  const gpuBudget = params.gpuBudget ?? new GpuContextBudget(2);
  const renderer = chooseWaveRenderer({
    preference: 'auto',
    look,
    createCanvas: setup.createCanvas,
    onContextLost: jest.fn(),
    gpuBudget,
    ...params,
  });
  return { ...setup, renderer, gpuBudget };
}

describe('chooseWaveRenderer', () => {
  beforeEach(() => jest.spyOn(console, 'warn').mockImplementation());

  it('draws on the GPU where WebGL2 runs', () => {
    expect(choose({}).renderer?.kind).toBe('webgl');
  });

  it('draws on the GPU for the webgl preference too', () => {
    expect(choose({}, { preference: 'webgl' }).renderer?.kind).toBe('webgl');
  });

  it('falls back to the 2D canvas where the browser refuses WebGL2 (no GPU)', () => {
    const { renderer, gpuBudget } = choose('none');
    expect(renderer?.kind).toBe('canvas');
    // the refused context gave its place in the budget back
    expect(gpuBudget.tryAcquire()).toBe(true);
    expect(gpuBudget.tryAcquire()).toBe(true);
  });

  it('falls back to the 2D canvas for the webgl preference too', () => {
    expect(choose('none', { preference: 'webgl' }).renderer?.kind).toBe(
      'canvas'
    );
  });

  it('falls back to the 2D canvas when the shader does not compile', () => {
    const { renderer, fake } = choose({ compiles: false });
    expect(renderer?.kind).toBe('canvas');
    expect(fake?.loseContext).toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
  });

  it('falls back to the 2D canvas once the GPU budget is used up', () => {
    const gpuBudget = new GpuContextBudget(1);
    expect(choose({}, { gpuBudget }).renderer?.kind).toBe('webgl');
    expect(choose({}, { gpuBudget }).renderer?.kind).toBe('canvas');
  });

  it('gives the budget back when the GPU renderer is disposed', () => {
    const gpuBudget = new GpuContextBudget(1);
    choose({}, { gpuBudget }).renderer?.dispose();
    expect(choose({}, { gpuBudget }).renderer?.kind).toBe('webgl');
  });

  it.each([
    ['auto', true],
    ['webgl', false],
  ] as const)(
    'asks with %p for a GPU only: failIfMajorPerformanceCaveat %p',
    (preference, hardwareOnly) => {
      const getContext = jest.spyOn(HTMLCanvasElement.prototype, 'getContext');
      getContext.mockReturnValue(null);
      chooseWaveRenderer({
        preference,
        look,
        createCanvas: () => document.createElement('canvas'),
        onContextLost: jest.fn(),
        gpuBudget: new GpuContextBudget(1),
      });
      expect(getContext).toHaveBeenCalledWith(
        'webgl2',
        expect.objectContaining({
          failIfMajorPerformanceCaveat: hardwareOnly,
        })
      );
      getContext.mockRestore();
    }
  );

  it('never asks for WebGL with the canvas preference', () => {
    const { renderer, contextTypes } = choose({}, { preference: 'canvas' });
    expect(renderer?.kind).toBe('canvas');
    expect(contextTypes).toEqual(['2d']);
  });
});
