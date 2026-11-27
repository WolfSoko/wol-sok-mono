import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  booleanAttribute,
  DestroyRef,
  Directive,
  effect,
  ElementRef,
  inject,
  InjectionToken,
  input,
  PLATFORM_ID,
  signal,
  untracked,
} from '@angular/core';
import { LoadingWave } from './loading-wave';
import {
  LOADING_WAVE_OPTIONS,
  LoadingWaveOptions,
  resolveLoadingWaveOptions,
} from './loading-wave-options';
import type { WaveRendererKind } from './renderer';
import { browserWaveEnvironment, WaveEnvironment } from './wave-environment';

/** the browser APIs the wave runs on; specs replace them */
export const LOADING_WAVE_ENVIRONMENT = new InjectionToken<WaveEnvironment>(
  'LOADING_WAVE_ENVIRONMENT',
  {
    providedIn: 'root',
    factory: () => browserWaveEnvironment(inject(DOCUMENT)),
  }
);

/**
 * Lays a calm loading wave behind the host's content: a grid of dots that a
 * curved wave front lights again and again while `wsLoadingWave` is true.
 *
 * ```html
 * <section [wsLoadingWave]="loading()" [wsLoadingWaveOptions]="{ afterLoading: 'keep' }">
 * ```
 *
 * Runs only in the browser, never on the server.
 */
@Directive({
  selector: '[wsLoadingWave]',
  exportAs: 'wsLoadingWave',
})
export class LoadingWaveDirective {
  /** whether the host is loading */
  public readonly wsLoadingWave = input(false, {
    transform: booleanAttribute,
  });
  /** overrides the app-wide options (`provideLoadingWave`) for this host */
  public readonly wsLoadingWaveOptions = input<Partial<LoadingWaveOptions>>();

  private readonly activeRendererState = signal<WaveRendererKind | null>(null);
  /** what draws the effect right now, `null` while nothing shows */
  public readonly activeRenderer = this.activeRendererState.asReadonly();

  public constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) {
      return;
    }
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const defaults = inject(LOADING_WAVE_OPTIONS);
    const env = inject(LOADING_WAVE_ENVIRONMENT);
    const rendered = signal(false);
    let wave: LoadingWave | undefined;
    let appliedOptions = '';

    afterNextRender(() => rendered.set(true));
    inject(DestroyRef).onDestroy(() => wave?.dispose());

    effect(() => {
      if (!rendered()) {
        return;
      }
      const options = resolveLoadingWaveOptions(
        defaults,
        this.wsLoadingWaveOptions()
      );
      const loading = this.wsLoadingWave();
      untracked(() => {
        const optionsKey = JSON.stringify(options);
        if (wave == null) {
          wave = new LoadingWave(host, options, env, (kind) =>
            this.activeRendererState.set(kind)
          );
        } else if (optionsKey !== appliedOptions) {
          wave.setOptions(options);
        }
        appliedOptions = optionsKey;
        wave.setLoading(loading);
      });
    });
  }
}
