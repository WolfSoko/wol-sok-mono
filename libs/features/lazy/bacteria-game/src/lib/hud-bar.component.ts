import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ColonyStats } from './colony-stats';
import { TranslationKey } from './i18n/dictionaries';
import {
  GameText,
  GameTextPipe,
  playerNameText,
  renderGameText,
} from './i18n/game-texts';
import { I18nService } from './i18n/i18n.service';
import { TranslatePipe } from './i18n/translate.pipe';

/**
 * What a colony counts up towards on a level won by reaching a goal - the
 * seconds on the zone, the pellets eaten.
 */
export interface HudGoal {
  icon: string;
  /** What is counted, for a screen reader. */
  label: TranslationKey;
  target: number;
  /** The colony's number that counts up. */
  of: 'held' | 'pellets';
}

/**
 * The bar above the arena while a match is on: the level, the clock, each
 * colony's count and the match's buttons - sound, pause (or giving up a
 * ranked match, in two taps) and fullscreen.
 */
@Component({
  selector: 'feat-lazy-bac-game-hud-bar',
  imports: [
    GameTextPipe,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    TranslatePipe,
  ],
  templateUrl: './hud-bar.component.html',
  styleUrl: './hud-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HudBarComponent {
  private readonly i18n = inject(I18nService);

  public readonly levelName = input.required<GameText>();
  /** The clock as read out, and as shown. */
  public readonly clockLabel = input.required<string>();
  public readonly clockText = input.required<string>();
  public readonly timeRunningOut = input(false);
  public readonly colonies = input.required<readonly ColonyStats[]>();
  public readonly goal = input<HudGoal | null>(null);
  /** The neutral colonies' count, null on a level without them. */
  public readonly neutral = input<number | null>(null);
  public readonly neutralCss = input.required<string>();
  public readonly sound = input.required<boolean>();
  /** True where the match can be paused right now. */
  public readonly showPause = input(false);
  /** True during a ranked match, which has no pause menu. */
  public readonly showGiveUp = input(false);
  public readonly giveUpArmed = input(false);
  public readonly fullscreen = input.required<boolean>();

  public readonly soundChange = output<boolean>();
  public readonly pause = output<void>();
  public readonly giveUp = output<void>();
  public readonly fullscreenChange = output<boolean>();

  /**
   * A colony's name in the active language: "You", "Computer" and the
   * colours are translated, an online opponent's name stays as it is.
   */
  protected colonyName(name: string): string {
    const text = playerNameText(name);
    return text === null
      ? name
      : renderGameText(text, (key, params) => this.i18n.t(key, params));
  }
}
