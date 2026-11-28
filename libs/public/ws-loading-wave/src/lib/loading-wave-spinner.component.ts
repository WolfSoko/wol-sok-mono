import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { LoadingWaveDirective } from './loading-wave.directive';
import { LoadingWaveOptions, withoutUnset } from './loading-wave-options';

/** a spinner's size on each side when unset, in CSS pixels */
const DEFAULT_DIAMETER = 40;

/** a ripple from the middle, a little quicker than the wave's sweep */
const SPINNER_OPTIONS: Partial<LoadingWaveOptions> = {
  origin: 'center',
  sweepMs: 1200,
};

/**
 * A round loading spinner in the wave's style: a dish of dots that a ripple
 * from its middle lights again and again. It spins while it is there; show
 * it with `@if`.
 *
 * ```html
 * @if (loading()) {
 *   <ws-loading-wave-spinner [diameter]="24" label="Saving" />
 * }
 * ```
 *
 * The app-wide options of `provideLoadingWave` apply as for the directive;
 * `options` lays its own over the ripple.
 */
@Component({
  selector: 'ws-loading-wave-spinner',
  imports: [LoadingWaveDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span
    class="dish"
    [wsLoadingWave]="true"
    [wsLoadingWaveOptions]="waveOptions()"
  ></span>`,
  styles: `
    :host {
      display: inline-block;
      vertical-align: middle;
      border-radius: 50%;
    }

    .dish {
      display: block;
      width: 100%;
      height: 100%;
      border-radius: inherit;
    }
  `,
  host: {
    role: 'progressbar',
    '[attr.aria-label]': 'label()',
    '[style.width.px]': 'diameter()',
    '[style.height.px]': 'diameter()',
  },
})
export class LoadingWaveSpinnerComponent {
  /** width and height, in CSS pixels */
  public readonly diameter = input(DEFAULT_DIAMETER);
  /** what assistive technology announces */
  public readonly label = input('Loading');
  /** options laid over the spinner's ripple; unset values keep the ripple's */
  public readonly options = input<Partial<LoadingWaveOptions>>();

  protected readonly waveOptions = computed<Partial<LoadingWaveOptions>>(
    () => ({ ...SPINNER_OPTIONS, ...withoutUnset(this.options() ?? {}) })
  );
}
