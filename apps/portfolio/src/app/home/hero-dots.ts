import {
  afterNextRender,
  DestroyRef,
  inject,
  Signal,
  signal,
} from '@angular/core';
// types only: the directive's code loads in the hero's @defer block
import type { LoadingWaveOptions } from '@wolsok/loading-wave';

/** the hero's dotted background: the dots stay once the intro waves passed */
export const HERO_DOTS = {
  afterLoading: 'keep',
  dotSpacing: 26,
  sweepMs: 1600,
} as const satisfies Partial<LoadingWaveOptions>;

/** how many sweeps of the wave cross the hero before it rests */
export const HERO_INTRO_SWEEPS = 2;

/**
 * True from the first render in the browser until the intro's sweeps
 * passed, so the hero's dots light up twice and then rest. Never true on
 * the server: the prerendered page holds no canvas.
 */
export function heroDotsIntro(): Signal<boolean> {
  const intro = signal(false);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  afterNextRender(() => {
    intro.set(true);
    timeout = setTimeout(
      () => intro.set(false),
      HERO_INTRO_SWEEPS * HERO_DOTS.sweepMs
    );
  });
  inject(DestroyRef).onDestroy(() => clearTimeout(timeout));
  return intro.asReadonly();
}
