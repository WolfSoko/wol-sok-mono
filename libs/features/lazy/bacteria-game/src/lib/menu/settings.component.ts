import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
} from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import {
  ColonyColorsComponent,
  ColorChange,
} from '../colony-colors/colony-colors.component';
import { Size } from '../fullscreen';
import { BACTERIA_LOOKS, GameSettingsService } from '../settings.service';
import { SCREEN_RESOLUTIONS, SIM_RESOLUTIONS } from '../state/arena-size';
import { GameMode } from '../state/game.states';
import { LEVELS } from '../state/levels';
import { ScreenHeaderComponent } from './screen-header.component';

/**
 * The settings screen: colony colours, how the arena is drawn, sound and
 * the browser's fullscreen. What only the game service keeps - look,
 * resolutions, frame rate, music - it sets right there; what the game
 * decides on - colours, sound with its click, fullscreen - it reports.
 */
@Component({
  selector: 'feat-lazy-bac-game-settings',
  imports: [
    ColonyColorsComponent,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatSelectModule,
    MatSlideToggleModule,
    ScreenHeaderComponent,
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent {
  protected readonly settings = inject(GameSettingsService);

  public readonly mode = input.required<GameMode>();
  /** The colour ids of the left and the right colony. */
  public readonly colors = input.required<readonly [string, string]>();
  /** True while a match is on: colours and resolutions wait for the next. */
  public readonly locked = input(false);
  /** The arena in cells at the chosen simulation resolution. */
  public readonly arenaSize = input.required<Size>();
  public readonly nativeFullscreenSupported = input(false);
  public readonly nativeFullscreen = input(false);
  /** Names where the way back leads. */
  public readonly backLabel = input('Menu');
  /** Why each colony colour still to earn is locked, by colour id. */
  public readonly colorLocks = input<Readonly<Record<string, string>>>({});
  /** Why each level's arena is still locked, by level id. */
  public readonly arenaLocks = input<Readonly<Record<string, string>>>({});

  public readonly colorChange = output<ColorChange>();
  public readonly soundChange = output<boolean>();
  public readonly nativeFullscreenChange = output<boolean>();
  public readonly back = output<void>();

  protected readonly looks = BACTERIA_LOOKS;
  protected readonly levels = LEVELS;
  /** The select's value for each level in its own arena - Material reads null as none chosen. */
  protected readonly ownArena = 'own';

  protected pickArena(value: string): void {
    this.settings.setArena(value === this.ownArena ? null : value);
  }
  protected readonly simResolutions = SIM_RESOLUTIONS;
  protected readonly screenResolutions = SCREEN_RESOLUTIONS;
}
