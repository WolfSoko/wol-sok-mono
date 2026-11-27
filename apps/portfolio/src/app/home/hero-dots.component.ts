import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { LoadingWaveDirective, LoadingWaveOptions } from '@wolsok/loading-wave';

/** the hero's dotted background: the dots stay once the intro waves passed */
export const HERO_DOTS = {
  afterLoading: 'keep',
  dotSpacing: 26,
  sweepMs: 1600,
} as const satisfies Partial<LoadingWaveOptions>;

/** how many sweeps of the wave cross the hero before it rests */
export const HERO_INTRO_SWEEPS = 2;

/**
 * The hero's decoration: from its first render in the browser, two waves
 * light its dots, which then rest. The home page loads it with `@defer`, so
 * the intro starts once the dots are there, however late that is; the
 * prerendered page holds no canvas.
 */
@Component({
  selector: 'wolsok-hero-dots',
  imports: [LoadingWaveDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div
    class="dots"
    [wsLoadingWave]="intro()"
    [wsLoadingWaveOptions]="options"
  ></div>`,
  styleUrl: './hero-dots.component.scss',
  host: { 'aria-hidden': 'true' },
})
export class HeroDotsComponent {
  protected readonly options = HERO_DOTS;
  private readonly introState = signal(false);
  /** true while the intro waves run */
  public readonly intro = this.introState.asReadonly();

  public constructor() {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    afterNextRender(() => {
      this.introState.set(true);
      timeout = setTimeout(
        () => this.introState.set(false),
        HERO_INTRO_SWEEPS * HERO_DOTS.sweepMs
      );
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(timeout));
  }
}
