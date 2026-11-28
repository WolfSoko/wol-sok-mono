import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import {
  DEFAULT_LOADING_WAVE_OPTIONS,
  LoadingWaveDirective,
  LoadingWaveOptions,
  LoadingWaveShader,
  rippleShader,
} from '@wolsok/loading-wave';
import {
  circuitTracesShader,
  dataBusShader,
  dieScanShader,
  signalTraceShader,
  sparkFrontShader,
} from '@wolsok/loading-wave/shaders';
import { CUSTOM_SHADER_EXAMPLE } from './custom-shader-example';

/** the options the playground offers; renderer and shader are each stage's own */
export type PlaygroundOptions = Omit<LoadingWaveOptions, 'renderer' | 'shader'>;

interface ColorChoice {
  readonly label: string;
  /** a theme colour; `undefined` leaves the option unset */
  readonly value: string | undefined;
}

/** theme tokens only, so every choice shows in the light and the dark theme */
const THEME_COLORS: readonly ColorChoice[] = [
  { label: 'Primary', value: 'var(--mat-sys-primary)' },
  { label: 'Tertiary', value: 'var(--mat-sys-tertiary)' },
];

/** the dots' colour: unset, the stage's text colour */
const COLOR_CHOICES: readonly ColorChoice[] = [
  { label: 'Text', value: undefined },
  ...THEME_COLORS,
];

/** the accent: unset, the dots' colour */
const ACCENT_CHOICES: readonly ColorChoice[] = [
  { label: 'Dots', value: undefined },
  ...THEME_COLORS,
];

/** a built-in shader, by the name and entry point it is exported from */
interface ShaderChoice {
  readonly name: string;
  readonly label: string;
  readonly shader: LoadingWaveShader;
  readonly entryPoint: string;
}

const MAIN_ENTRY = '@wolsok/loading-wave';
const SHADERS_ENTRY = '@wolsok/loading-wave/shaders';

const SHADER_CHOICES: readonly ShaderChoice[] = [
  {
    name: 'rippleShader',
    label: 'Ripple',
    shader: rippleShader,
    entryPoint: MAIN_ENTRY,
  },
  {
    name: 'circuitTracesShader',
    label: 'Circuit traces',
    shader: circuitTracesShader,
    entryPoint: SHADERS_ENTRY,
  },
  {
    name: 'dataBusShader',
    label: 'Data bus',
    shader: dataBusShader,
    entryPoint: SHADERS_ENTRY,
  },
  {
    name: 'dieScanShader',
    label: 'Die scan',
    shader: dieScanShader,
    entryPoint: SHADERS_ENTRY,
  },
  {
    name: 'signalTraceShader',
    label: 'Signal trace',
    shader: signalTraceShader,
    entryPoint: SHADERS_ENTRY,
  },
  {
    name: 'sparkFrontShader',
    label: 'Spark front',
    shader: sparkFrontShader,
    entryPoint: SHADERS_ENTRY,
  },
];

/** the pick of one's own fragment; every other pick names a built-in shader */
const CUSTOM_PICK = 'custom';

/** try every option of @wolsok/loading-wave on the GPU and on a 2D canvas side by side */
@Component({
  selector: 'app-loading-wave-playground',
  templateUrl: './loading-wave-playground.component.html',
  styleUrls: ['./loading-wave-playground.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LoadingWaveDirective,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatSliderModule,
  ],
})
export class LoadingWavePlaygroundComponent {
  protected readonly colorChoices = COLOR_CHOICES;
  protected readonly accentChoices = ACCENT_CHOICES;
  protected readonly shaderChoices = SHADER_CHOICES;
  protected readonly customPick = CUSTOM_PICK;
  public readonly loading = signal(true);
  public readonly options = signal<PlaygroundOptions>({
    afterLoading: DEFAULT_LOADING_WAVE_OPTIONS.afterLoading,
    dotSpacing: DEFAULT_LOADING_WAVE_OPTIONS.dotSpacing,
    dotSize: DEFAULT_LOADING_WAVE_OPTIONS.dotSize,
    sweepMs: DEFAULT_LOADING_WAVE_OPTIONS.sweepMs,
    frontRoundness: DEFAULT_LOADING_WAVE_OPTIONS.frontRoundness,
    color: undefined,
    accentColor: undefined,
  });
  /** what the shader stage draws with: a built-in shader's name or `CUSTOM_PICK` */
  public readonly shaderPick = signal<string>(SHADER_CHOICES[0].name);
  /** the custom fragment as typed */
  protected readonly customDraft = signal(CUSTOM_SHADER_EXAMPLE);
  /** the custom fragment the stage draws, set by "Apply" */
  private readonly customFragment = signal(CUSTOM_SHADER_EXAMPLE);

  /** the built-in shader picked; `undefined` for one's own */
  private readonly builtInPick = computed(() =>
    SHADER_CHOICES.find((choice) => choice.name === this.shaderPick())
  );
  private readonly shader = computed<LoadingWaveShader>(() =>
    this.shaderPick() === CUSTOM_PICK
      ? { fragment: this.customFragment() }
      : (this.builtInPick()?.shader ?? rippleShader)
  );
  protected readonly gpuOptions = computed<LoadingWaveOptions>(() => ({
    ...this.options(),
    renderer: 'webgl',
    shader: this.shader(),
  }));
  protected readonly canvasOptions = computed<LoadingWaveOptions>(() => ({
    ...this.options(),
    renderer: 'canvas',
  }));
  /** shown to copy into provideLoadingWave or [wsLoadingWaveOptions] */
  protected readonly optionsJson = computed(() =>
    JSON.stringify(this.options(), null, 2)
  );
  /** how to pass the stage's shader, which JSON cannot hold */
  protected readonly shaderOption = computed(() => {
    const builtIn = this.builtInPick();
    return builtIn == null
      ? // a JSON string is a valid TypeScript string literal, escapes included
        `shader: { fragment: ${JSON.stringify(this.customFragment())} }`
      : `shader: ${builtIn.name} (import { ${builtIn.name} } from '${builtIn.entryPoint}')`;
  });

  protected setOption<K extends keyof PlaygroundOptions>(
    key: K,
    value: PlaygroundOptions[K]
  ): void {
    this.options.update((options) => ({ ...options, [key]: value }));
  }

  protected applyCustomFragment(): void {
    this.customFragment.set(this.customDraft());
  }
}
