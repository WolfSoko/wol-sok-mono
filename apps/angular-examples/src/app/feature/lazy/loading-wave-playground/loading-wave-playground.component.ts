import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import {
  DEFAULT_LOADING_WAVE_OPTIONS,
  LoadingWaveDirective,
  LoadingWaveOptions,
} from '@wolsok/loading-wave';

/** the options the playground offers; the renderer is each stage's own */
export type PlaygroundOptions = Omit<LoadingWaveOptions, 'renderer'>;

interface ColorChoice {
  readonly label: string;
  /** `undefined`: the stage's text colour */
  readonly value: string | undefined;
}

const COLOR_CHOICES: readonly ColorChoice[] = [
  { label: 'Text', value: undefined },
  { label: 'Cyan', value: '#4dd0e1' },
  { label: 'Lime', value: '#c6ff00' },
  { label: 'Rose', value: '#ff6e91' },
];

/** try every option of @wolsok/loading-wave on the GPU and on a 2D canvas side by side */
@Component({
  selector: 'app-loading-wave-playground',
  templateUrl: './loading-wave-playground.component.html',
  styleUrls: ['./loading-wave-playground.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LoadingWaveDirective,
    MatButtonToggleModule,
    MatCardModule,
    MatSlideToggleModule,
    MatSliderModule,
  ],
})
export class LoadingWavePlaygroundComponent {
  protected readonly colorChoices = COLOR_CHOICES;
  public readonly loading = signal(true);
  public readonly options = signal<PlaygroundOptions>({
    afterLoading: DEFAULT_LOADING_WAVE_OPTIONS.afterLoading,
    dotSpacing: DEFAULT_LOADING_WAVE_OPTIONS.dotSpacing,
    dotSize: DEFAULT_LOADING_WAVE_OPTIONS.dotSize,
    sweepMs: DEFAULT_LOADING_WAVE_OPTIONS.sweepMs,
    color: undefined,
  });
  protected readonly gpuOptions = computed<LoadingWaveOptions>(() => ({
    ...this.options(),
    renderer: 'webgl',
  }));
  protected readonly canvasOptions = computed<LoadingWaveOptions>(() => ({
    ...this.options(),
    renderer: 'canvas',
  }));
  /** shown to copy into provideLoadingWave or [wsLoadingWaveOptions] */
  protected readonly optionsJson = computed(() =>
    JSON.stringify(this.options(), null, 2)
  );

  protected setOption<K extends keyof PlaygroundOptions>(
    key: K,
    value: PlaygroundOptions[K]
  ): void {
    this.options.update((options) => ({ ...options, [key]: value }));
  }
}
