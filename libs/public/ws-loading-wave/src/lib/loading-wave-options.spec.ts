import { TestBed } from '@angular/core/testing';
import {
  DEFAULT_LOADING_WAVE_OPTIONS,
  LOADING_WAVE_OPTIONS,
  provideLoadingWave,
  resolveLoadingWaveOptions,
} from './loading-wave-options';
import { rippleShader } from './webgl/shaders/ripple.shader';

describe('loading wave options', () => {
  it('defaults to hiding the dots, the auto renderer and the video look', () => {
    expect(TestBed.inject(LOADING_WAVE_OPTIONS)).toEqual({
      afterLoading: 'hide',
      dotSpacing: 28,
      dotSize: 1.5,
      sweepMs: 1600,
      autoscale: true,
      origin: 'left',
      renderer: 'auto',
      frontRoundness: 0.5,
      shader: rippleShader,
    });
  });

  it('takes app-wide defaults from provideLoadingWave', () => {
    TestBed.configureTestingModule({
      providers: [provideLoadingWave({ afterLoading: 'keep', color: 'red' })],
    });
    expect(TestBed.inject(LOADING_WAVE_OPTIONS)).toEqual({
      ...DEFAULT_LOADING_WAVE_OPTIONS,
      afterLoading: 'keep',
      color: 'red',
    });
  });

  it('lets per-element options win over the defaults', () => {
    const defaults = resolveLoadingWaveOptions(DEFAULT_LOADING_WAVE_OPTIONS, {
      dotSpacing: 40,
    });
    expect(
      resolveLoadingWaveOptions(defaults, { dotSpacing: 12, sweepMs: 900 })
    ).toEqual({
      ...DEFAULT_LOADING_WAVE_OPTIONS,
      dotSpacing: 12,
      sweepMs: 900,
    });
  });

  it('ignores undefined overrides', () => {
    expect(
      resolveLoadingWaveOptions(DEFAULT_LOADING_WAVE_OPTIONS, {
        renderer: undefined,
      })
    ).toEqual(DEFAULT_LOADING_WAVE_OPTIONS);
  });

  it.each([0, -3, Number.NaN, Number.POSITIVE_INFINITY])(
    'replaces the size or duration %p by the default',
    (bad) => {
      expect(
        resolveLoadingWaveOptions(DEFAULT_LOADING_WAVE_OPTIONS, {
          dotSpacing: bad,
          dotSize: bad,
          sweepMs: bad,
        })
      ).toEqual(DEFAULT_LOADING_WAVE_OPTIONS);
    }
  );

  it.each([
    [-0.5, 0],
    [0.3, 0.3],
    [7, 1],
    [Number.NaN, 0.5],
    [Number.NEGATIVE_INFINITY, 0.5],
  ])('resolves the front roundness %p to %p', (asked, resolved) => {
    expect(
      resolveLoadingWaveOptions(DEFAULT_LOADING_WAVE_OPTIONS, {
        frontRoundness: asked,
      }).frontRoundness
    ).toBe(resolved);
  });

  it.each([true, false, 0.5, 2])('keeps autoscale %p', (autoscale) => {
    expect(
      resolveLoadingWaveOptions(DEFAULT_LOADING_WAVE_OPTIONS, { autoscale })
        .autoscale
    ).toBe(autoscale);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'replaces the autoscale factor %p by the default',
    (autoscale) => {
      expect(
        resolveLoadingWaveOptions(DEFAULT_LOADING_WAVE_OPTIONS, { autoscale })
          .autoscale
      ).toBe(true);
      const fixed = { ...DEFAULT_LOADING_WAVE_OPTIONS, autoscale: false };
      expect(resolveLoadingWaveOptions(fixed, { autoscale }).autoscale).toBe(
        false
      );
    }
  );

  it('fills autoscale of defaults built without it with true', () => {
    const { autoscale, ...withoutAutoscale } = DEFAULT_LOADING_WAVE_OPTIONS;
    expect(autoscale).toBe(true);
    expect(resolveLoadingWaveOptions(withoutAutoscale).autoscale).toBe(true);
  });

  it("fills the origin of defaults built without it with 'left'", () => {
    const { origin, ...withoutOrigin } = DEFAULT_LOADING_WAVE_OPTIONS;
    expect(origin).toBe('left');
    expect(resolveLoadingWaveOptions(withoutOrigin).origin).toBe('left');
  });

  it('fills the front roundness of defaults built without it', () => {
    const { frontRoundness, ...withoutRoundness } =
      DEFAULT_LOADING_WAVE_OPTIONS;
    expect(frontRoundness).toBe(0.5);
    expect(resolveLoadingWaveOptions(withoutRoundness).frontRoundness).toBe(
      0.5
    );
  });
});
