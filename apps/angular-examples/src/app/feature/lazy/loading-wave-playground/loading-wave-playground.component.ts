import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import {
  DEFAULT_LOADING_WAVE_OPTIONS,
  LoadingWaveDirective,
  LoadingWaveOptions,
  LoadingWaveShader,
  LoadingWaveSpinnerComponent,
  rippleShader,
} from '@wolsok/loading-wave';
import {
  circuitTracesShader,
  dataBusShader,
  dieScanShader,
  signalTraceShader,
  sparkFrontShader,
} from '@wolsok/loading-wave/shaders';
import { CodeEditorComponent } from '@wolsok/ui-kit/code-editor';
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

interface AutoscaleChoice {
  readonly label: string;
  readonly value: NonNullable<LoadingWaveOptions['autoscale']>;
}

/** the grid on small hosts: finer, as set, or at half the set size everywhere */
const AUTOSCALE_CHOICES: readonly AutoscaleChoice[] = [
  { label: 'auto', value: true },
  { label: 'off', value: false },
  { label: '½', value: 0.5 },
];

/** the spinners shown, by diameter in CSS pixels */
const SPINNER_DIAMETERS = [24, 40, 64] as const;

/** how tall the custom shader's editor opens, in lines */
const EDITOR_LINES = 30;

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
    LoadingWaveSpinnerComponent,
    MatButtonModule,
    MatButtonToggleModule,
    CodeEditorComponent,
    MatCardModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
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
  protected readonly autoscaleChoices = AUTOSCALE_CHOICES;
  protected readonly editorLines = EDITOR_LINES;
  protected readonly spinnerDiameters = SPINNER_DIAMETERS;
  public readonly loading = signal(true);
  public readonly options = signal<PlaygroundOptions>({
    afterLoading: DEFAULT_LOADING_WAVE_OPTIONS.afterLoading,
    dotSpacing: DEFAULT_LOADING_WAVE_OPTIONS.dotSpacing,
    dotSize: DEFAULT_LOADING_WAVE_OPTIONS.dotSize,
    sweepMs: DEFAULT_LOADING_WAVE_OPTIONS.sweepMs,
    autoscale: DEFAULT_LOADING_WAVE_OPTIONS.autoscale,
    origin: DEFAULT_LOADING_WAVE_OPTIONS.origin,
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
  /**
   * the small elements draw with the stage's shader where the page's GPU
   * budget allows, else on a 2D canvas
   */
  protected readonly smallOptions = computed<LoadingWaveOptions>(() => ({
    ...this.options(),
    renderer: 'auto',
    shader: this.shader(),
  }));
  /** the small elements' options, but each spinner keeps its own origin */
  protected readonly spinnerOptions = computed<Partial<LoadingWaveOptions>>(
    () => {
      const { origin: _stagesOrigin, ...options } = this.smallOptions();
      return options;
    }
  );
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
