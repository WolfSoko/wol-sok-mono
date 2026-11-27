import { fakeWaveEnvironment } from './fake-wave-environment.mock';
import { fitPixelRatio, LoadingWave, MAX_CANVAS_PIXELS } from './loading-wave';
import {
  DEFAULT_LOADING_WAVE_OPTIONS,
  LoadingWaveOptions,
} from './loading-wave-options';
import { FADE_MS } from './wave-timeline';

function setUp(
  options: Partial<LoadingWaveOptions> = {},
  environment: Parameters<typeof fakeWaveEnvironment>[0] = {}
) {
  const fake = fakeWaveEnvironment(environment);
  const host = document.createElement('section');
  host.appendChild(document.createElement('p'));
  document.body.appendChild(host);
  const rendererChanges: (string | null)[] = [];
  const wave = new LoadingWave(
    host,
    { ...DEFAULT_LOADING_WAVE_OPTIONS, ...options },
    fake.env,
    (kind) => rendererChanges.push(kind)
  );
  return { ...fake, host, wave, rendererChanges };
}

describe('LoadingWave', () => {
  afterEach(() => (document.body.innerHTML = ''));

  it('shows nothing before loading starts', () => {
    const { host, pendingFrames } = setUp();
    expect(host.querySelector('canvas')).toBeNull();
    expect(pendingFrames()).toBe(0);
  });

  it('lays a hidden canvas behind the content while loading', () => {
    const { host, wave, rendererChanges } = setUp();
    wave.setLoading(true);
    const canvas = host.lastElementChild as HTMLCanvasElement;
    expect(canvas.tagName).toBe('CANVAS');
    // the host's own nodes keep their place for hydration
    expect(host.firstElementChild?.tagName).toBe('P');
    expect(canvas.getAttribute('aria-hidden')).toBe('true');
    expect(canvas.style.position).toBe('absolute');
    expect(canvas.style.zIndex).toBe('-1');
    expect(canvas.style.pointerEvents).toBe('none');
    expect(host.getAttribute('aria-busy')).toBe('true');
    expect(host.style.isolation).toBe('isolate');
    expect(rendererChanges).toEqual(['webgl']);
  });

  it('makes a static host relative, leaves a positioned one alone', () => {
    const first = setUp();
    first.wave.setLoading(true);
    expect(first.host.style.position).toBe('relative');

    const second = setUp();
    second.host.style.position = 'absolute';
    second.wave.setLoading(true);
    expect(second.host.style.position).toBe('absolute');
  });

  it('sizes the renderer to the host with the options', () => {
    const { wave, renderers, callbacks } = setUp({ dotSpacing: 12 });
    wave.setLoading(true);
    const [renderer] = renderers;
    expect(renderer.resize).toHaveBeenCalledWith(
      expect.objectContaining({ dotSpacing: 12 }),
      2
    );
    callbacks.resize.forEach((resize) => resize());
    expect(renderer.resize).toHaveBeenCalledTimes(2);
  });

  it('animates frame after frame while loading', () => {
    const { wave, renderers, advance } = setUp();
    wave.setLoading(true);
    advance(16);
    advance(FADE_MS);
    advance(16);
    const { frames } = renderers[0];
    expect(frames).toHaveLength(3);
    expect(frames[2]).toMatchObject({ wave: 1, dots: 1 });
    expect(frames[2].elapsedMs).toBeGreaterThan(frames[1].elapsedMs);
  });

  it("removes the canvas and frees the renderer after the fade with 'hide'", () => {
    const { host, wave, renderers, advance, observing, rendererChanges } =
      setUp();
    expect(observing()).toBe(0);
    wave.setLoading(true);
    advance(FADE_MS);
    wave.setLoading(false);
    expect(host.hasAttribute('aria-busy')).toBe(false);
    advance(FADE_MS / 2);
    expect(host.querySelector('canvas')).not.toBeNull();
    advance(FADE_MS);
    expect(host.querySelector('canvas')).toBeNull();
    expect(renderers[0].disposed).toBe(true);
    expect(host.style.position).toBe('');
    expect(host.style.isolation).toBe('');
    expect(rendererChanges).toEqual(['webgl', null]);
  });

  it("keeps the resting dots and stops the loop with 'keep'", () => {
    const fake = setUp({ afterLoading: 'keep' });
    fake.wave.setLoading(true);
    fake.advance(FADE_MS);
    fake.wave.setLoading(false);
    fake.advance(FADE_MS);
    expect(fake.host.querySelector('canvas')).not.toBeNull();
    expect(fake.renderers[0].frames.at(-1)).toMatchObject({ wave: 0, dots: 1 });
    expect(fake.pendingFrames()).toBe(0);
    // a resize redraws the resting dots once
    fake.callbacks.resize.forEach((resize) => resize());
    expect(fake.pendingFrames()).toBe(1);
    fake.advance(16);
    expect(fake.pendingFrames()).toBe(0);
  });

  it('pauses while off screen', () => {
    const { wave, advance, callbacks, renderers } = setUp();
    wave.setLoading(true);
    callbacks.visibility.forEach((change) => change(false));
    advance(100);
    expect(renderers[0].frames).toHaveLength(0);
    callbacks.visibility.forEach((change) => change(true));
    advance(16);
    expect(renderers[0].frames).toHaveLength(1);
  });

  it('draws no wave and stops once the dots are in with reduced motion', () => {
    const fake = setUp({}, { reducedMotion: true });
    fake.wave.setLoading(true);
    fake.advance(FADE_MS);
    expect(fake.renderers[0].frames.at(-1)).toMatchObject({ wave: 0, dots: 1 });
    expect(fake.pendingFrames()).toBe(0);
  });

  it('goes on with a 2D canvas when the GPU context is lost', () => {
    const { host, wave, renderers, chooseParams, rendererChanges, advance } =
      setUp();
    wave.setLoading(true);
    chooseParams[0].onContextLost();
    expect(chooseParams[1].preference).toBe('canvas');
    expect(renderers[0].disposed).toBe(true);
    expect(host.querySelectorAll('canvas')).toHaveLength(1);
    expect(host.querySelector('canvas')).toBe(renderers[1].canvas);
    expect(rendererChanges).toEqual(['webgl', 'canvas']);
    advance(16);
    expect(renderers[1].frames).toHaveLength(1);
  });

  it('recolours the dots when the theme changes', () => {
    const { wave, renderers, callbacks } = setUp();
    wave.setLoading(true);
    callbacks.theme.forEach((change) => change());
    expect(renderers[0].setLook).toHaveBeenCalledWith({
      dotSize: DEFAULT_LOADING_WAVE_OPTIONS.dotSize,
      color: { r: 1, g: 2, b: 3 },
    });
  });

  it('applies a new look, spacing and speed in place, without a new renderer', () => {
    const { wave, renderers } = setUp();
    wave.setLoading(true);
    wave.setOptions({
      ...DEFAULT_LOADING_WAVE_OPTIONS,
      dotSize: 3,
      dotSpacing: 40,
      sweepMs: 900,
    });
    expect(renderers).toHaveLength(1);
    expect(renderers[0].setLook).toHaveBeenLastCalledWith(
      expect.objectContaining({ dotSize: 3 })
    );
    expect(renderers[0].resize).toHaveBeenLastCalledWith(
      expect.objectContaining({ dotSpacing: 40, sweepMs: 900 }),
      2
    );
  });

  it("frees the canvas at once when loading ends off screen with 'hide'", () => {
    const fake = setUp();
    fake.wave.setLoading(true);
    fake.callbacks.visibility.forEach((change) => change(false));
    fake.wave.setLoading(false);
    expect(fake.host.querySelector('canvas')).toBeNull();
    expect(fake.renderers[0].disposed).toBe(true);
    expect(fake.observing()).toBe(0);
  });

  it('starts over with a new renderer while loading', () => {
    const { host, wave, renderers } = setUp();
    wave.setLoading(true);
    wave.setOptions({ ...DEFAULT_LOADING_WAVE_OPTIONS, renderer: 'canvas' });
    expect(renderers[0].disposed).toBe(true);
    expect(renderers[1].kind).toBe('canvas');
    expect(host.querySelectorAll('canvas')).toHaveLength(1);
  });

  it("keeps resting dots across new 'keep' options, drops them for 'hide'", () => {
    const fake = setUp({ afterLoading: 'keep' });
    fake.wave.setLoading(true);
    fake.wave.setLoading(false);
    fake.advance(FADE_MS);
    fake.wave.setOptions({
      ...DEFAULT_LOADING_WAVE_OPTIONS,
      afterLoading: 'keep',
      dotSize: 3,
    });
    fake.advance(16);
    expect(fake.renderers).toHaveLength(1);
    expect(fake.renderers[0].frames.at(-1)).toMatchObject({ dots: 1 });
    fake.wave.setOptions(DEFAULT_LOADING_WAVE_OPTIONS);
    expect(fake.host.querySelector('canvas')).toBeNull();
  });

  it('cleans everything up on dispose', () => {
    const fake = setUp();
    fake.wave.setLoading(true);
    expect(fake.observing()).toBe(3);
    fake.wave.dispose();
    expect(fake.host.querySelector('canvas')).toBeNull();
    expect(fake.host.hasAttribute('aria-busy')).toBe(false);
    expect(fake.renderers[0].disposed).toBe(true);
    expect(fake.observing()).toBe(0);
    expect(fake.pendingFrames()).toBe(0);
  });

  it('shows nothing where not even a 2D canvas works', () => {
    const fake = setUp();
    fake.env.chooseRenderer = () => null;
    fake.wave.setLoading(true);
    expect(fake.host.querySelector('canvas')).toBeNull();
    expect(fake.host.getAttribute('aria-busy')).toBe('true');
  });
});

describe('fitPixelRatio', () => {
  it('keeps the pixel ratio of a host of usual size', () => {
    expect(fitPixelRatio(1200, 800, 2)).toBe(2);
  });

  it('lowers it so a tall host stays within the pixel budget', () => {
    const ratio = fitPixelRatio(1500, 6000, 2);
    expect(ratio).toBeLessThan(1);
    expect(1500 * 6000 * ratio * ratio).toBeCloseTo(MAX_CANVAS_PIXELS, 0);
  });

  it('keeps it for an empty host', () => {
    expect(fitPixelRatio(0, 0, 2)).toBe(2);
  });
});
