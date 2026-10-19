import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
} from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import {
  ColonyColorsComponent,
  ColorChange,
} from '../colony-colors/colony-colors.component';
import { Size } from '../fullscreen';
import { BACTERIA_LOOKS, GameSettingsService } from '../settings.service';
import { SCREEN_RESOLUTIONS, SIM_RESOLUTIONS } from '../state/arena-size';
import { GameMode } from '../state/game.states';
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

  public readonly colorChange = output<ColorChange>();
  public readonly soundChange = output<boolean>();
  public readonly nativeFullscreenChange = output<boolean>();
  public readonly back = output<void>();

  protected readonly looks = BACTERIA_LOOKS;
  protected readonly simResolutions = SIM_RESOLUTIONS;
  protected readonly screenResolutions = SCREEN_RESOLUTIONS;
}
