import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { LookPreviewComponent } from '../arena/look-preview.component';
import { HERO_PREVIEW } from '../arena/look-preview';
import {
  ColonyColorsComponent,
  ColorChange,
} from '../colony-colors/colony-colors.component';
import { TranslationKey } from '../i18n/dictionaries';
import { I18nService } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { BACTERIA_LOOKS, GameSettingsService } from '../settings.service';
import { getColonyColor } from '../state/colony-colors';
import { GameMode } from '../state/game.states';
import { ScreenHeaderComponent } from './screen-header.component';

/**
 * The My Colony screen: the player's colony as it will look in the dish,
 * the skin it wears - every one free, each shown on a sample colony in the
 * player's colour - and the colonies' colours. More of the colony is to be
 * shaped here in time.
 */
@Component({
  selector: 'feat-lazy-bac-game-my-colony',
  imports: [
    ColonyColorsComponent,
    LookPreviewComponent,
    ScreenHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './my-colony.component.html',
  styleUrl: './my-colony.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyColonyComponent {
  protected readonly settings = inject(GameSettingsService);
  private readonly i18n = inject(I18nService);

  public readonly mode = input.required<GameMode>();
  /** The colour ids of the left and the right colony - the player's first. */
  public readonly colors = input.required<readonly [string, string]>();
  /** True while a match is on: the colours wait for the next. */
  public readonly locked = input(false);
  /** Why each colony colour still to earn is locked, by colour id. */
  public readonly colorLocks = input<Readonly<Record<string, string>>>({});

  public readonly colorChange = output<ColorChange>();
  public readonly back = output<void>();

  protected readonly heroSize = HERO_PREVIEW;
  protected readonly skins = BACTERIA_LOOKS.map((id) => ({
    id,
    label: `colony.skin.names.${id}` satisfies TranslationKey,
  }));

  /** The player's colour, RGB. */
  protected readonly playerRgb = computed(
    () => getColonyColor(this.colors()[0]).rgb
  );
  /** The name of the skin worn, in the active language. */
  protected readonly skinName = computed(() =>
    this.i18n.t(`colony.skin.names.${this.settings.look()}`)
  );
}
