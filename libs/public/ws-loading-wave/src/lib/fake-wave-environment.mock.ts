import type { ChooseWaveRendererParams } from './choose-wave-renderer';
import type { WaveFrame, WaveRenderer, WaveRendererKind } from './renderer';
import type { WaveEnvironment } from './wave-environment';

export interface FakeRenderer extends WaveRenderer {
  readonly frames: WaveFrame[];
  readonly disposed: boolean;
}

function fakeRenderer(kind: WaveRendererKind): FakeRenderer {
  const frames: WaveFrame[] = [];
  let disposed = false;
  return {
    kind,
    canvas: document.createElement('canvas'),
    frames,
    get disposed() {
      return disposed;
    },
    resize: jest.fn(),
    setLook: jest.fn(),
    draw: (frame) => frames.push(frame),
    dispose: () => {
      disposed = true;
    },
  };
}

/** a browser with a hand-driven clock and animation frames, for specs */
export function fakeWaveEnvironment({
  gpu = true,
  reducedMotion = false,
}: { gpu?: boolean; reducedMotion?: boolean } = {}) {
  let now = 0;
  let nextFrameId = 1;
  const frameCallbacks = new Map<number, () => void>();
  const renderers: FakeRenderer[] = [];
  const chooseParams: ChooseWaveRendererParams[] = [];
  const callbacks = {
    resize: [] as (() => void)[],
    visibility: [] as ((visible: boolean) => void)[],
    theme: [] as (() => void)[],
  };
  let observing = 0;
  const observe = <T>(list: T[], callback: T) => {
    list.push(callback);
    observing++;
    return () => {
      list.splice(list.indexOf(callback), 1);
      observing--;
    };
  };

  const env: WaveEnvironment = {
    now: () => now,
    requestFrame: (callback) => {
      const id = nextFrameId++;
      frameCallbacks.set(id, callback);
      return id;
    },
    cancelFrame: (id) => frameCallbacks.delete(id),
    pixelRatio: () => 2,
    prefersReducedMotion: () => reducedMotion,
    createCanvas: () => document.createElement('canvas'),
    chooseRenderer: (params) => {
      chooseParams.push(params);
      const renderer = fakeRenderer(
        gpu && params.preference !== 'canvas' ? 'webgl' : 'canvas'
      );
      renderers.push(renderer);
      return renderer;
    },
    resolveColor: () => ({ r: 1, g: 2, b: 3 }),
    observeSize: (_element, onResize) => observe(callbacks.resize, onResize),
    observeVisibility: (_element, onChange) =>
      observe(callbacks.visibility, onChange),
    observeTheme: (onChange) => observe(callbacks.theme, onChange),
  };

  return {
    env,
    renderers,
    chooseParams,
    callbacks,
    pendingFrames: () => frameCallbacks.size,
    observing: () => observing,
    /** moves the clock on and runs the frames that were due */
    advance(ms: number) {
      now += ms;
      const due = [...frameCallbacks.entries()];
      frameCallbacks.clear();
      due.forEach(([, callback]) => callback());
    },
  };
}
