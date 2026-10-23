import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import {
  ColonyColorsComponent,
  ColorChange,
} from '../colony-colors/colony-colors.component';
import { Size } from '../fullscreen';
import { TranslationKey } from '../i18n/dictionaries';
import { I18nService } from '../i18n/i18n.service';
import { Language, LANGUAGES } from '../i18n/language';
import { TranslatePipe } from '../i18n/translate.pipe';
import {
  BACTERIA_LOOKS,
  GameSettingsService,
  MAX_VOLUME,
} from '../settings.service';
import { SCREEN_RESOLUTIONS, SIM_RESOLUTIONS } from '../state/arena-size';
import { GameMode } from '../state/game.states';
import { LEVELS } from '../state/levels';
import { VAPORIZE_DURATIONS, VAPORIZE_QUALITIES } from '../vaporize-effect';
import { ScreenHeaderComponent } from './screen-header.component';

/**
 * The settings screen: colony colours, how the arena is drawn and
 * vaporized, sound, music and effects with their volumes, vibration, the
 * browser's fullscreen and the language. What only the game service keeps -
 * look, resolutions, the vaporize effect, frame rate, the music switch and
 * the volumes - it sets right there; what the game answers with a sound or a
 * buzz of its own - colours, the sound, effects and vibration switches,
 * fullscreen - it reports.
 */
@Component({
  selector: 'feat-lazy-bac-game-settings',
  imports: [
    ColonyColorsComponent,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatSliderModule,
    ScreenHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent {
  protected readonly settings = inject(GameSettingsService);
  private readonly i18n = inject(I18nService);

  public readonly mode = input.required<GameMode>();
  /** The colour ids of the left and the right colony. */
  public readonly colors = input.required<readonly [string, string]>();
  /** True while a match is on: colours and resolutions wait for the next. */
  public readonly locked = input(false);
  /** The arena in cells at the chosen simulation resolution. */
  public readonly arenaSize = input.required<Size>();
  public readonly nativeFullscreenSupported = input(false);
  public readonly nativeFullscreen = input(false);
  /** False where the device cannot vibrate: the switch is left out then. */
  public readonly vibrationSupported = input(false);
  /** Names where the way back leads - the menu unless told otherwise. */
  public readonly backLabel = input<string | null>(null);
  /** Why each colony colour still to earn is locked, by colour id. */
  public readonly colorLocks = input<Readonly<Record<string, string>>>({});
  /** Why each level's arena is still locked, by level id. */
  public readonly arenaLocks = input<Readonly<Record<string, string>>>({});
  /** The arena every level is drawn in, null for each its own. */
  public readonly activeArena = input<string | null>(null);

  public readonly colorChange = output<ColorChange>();
  public readonly soundChange = output<boolean>();
  public readonly effectsChange = output<boolean>();
  /** The effects slider moved - for a tick at the new volume. */
  public readonly effectsVolumePreview = output<void>();
  public readonly vibrationChange = output<boolean>();
  public readonly nativeFullscreenChange = output<boolean>();
  public readonly back = output<void>();

  protected readonly looks = BACTERIA_LOOKS.map(({ id }) => ({
    id,
    label: `settings.display.looks.${id}` satisfies TranslationKey,
  }));
  protected readonly levels = LEVELS;
  protected readonly maxVolume = MAX_VOLUME;
  /** The select's value for each level in its own arena - Material reads null as none chosen. */
  protected readonly ownArena = 'own';

  protected pickArena(value: string): void {
    this.settings.setArena(value === this.ownArena ? null : value);
  }
  protected readonly simResolutions = SIM_RESOLUTIONS.map(({ id }) => ({
    id,
    label: `settings.display.simResolutions.${id}` satisfies TranslationKey,
  }));
  protected readonly screenResolutions = SCREEN_RESOLUTIONS;
  protected readonly vaporizeQualities = VAPORIZE_QUALITIES;
  protected readonly vaporizeDurations = VAPORIZE_DURATIONS;

  /** The language picker's value for following the browser. */
  protected readonly automatic = 'auto' as const;
  protected readonly languages = LANGUAGES;
  protected readonly languageChoice = computed(
    () => this.settings.language() ?? this.automatic
  );

  protected pickLanguage(value: Language | 'auto'): void {
    this.settings.setLanguage(value === this.automatic ? null : value);
  }

  /** The slider's label: a volume as a percentage, for the locale. */
  protected readonly percent = computed(() => {
    const percent = new Intl.NumberFormat(this.i18n.locale(), {
      style: 'percent',
    });
    return (volume: number): string => percent.format(volume / 100);
  });
}
