import { TestBed } from '@angular/core/testing';
import {
  DEFAULT_LOADING_WAVE_OPTIONS,
  LOADING_WAVE_OPTIONS,
  provideLoadingWave,
  resolveLoadingWaveOptions,
} from './loading-wave-options';

describe('loading wave options', () => {
  it('defaults to hiding the dots, the auto renderer and the video look', () => {
    expect(TestBed.inject(LOADING_WAVE_OPTIONS)).toEqual({
      afterLoading: 'hide',
      dotSpacing: 28,
      dotSize: 1.5,
      sweepMs: 1600,
      renderer: 'auto',
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
});
