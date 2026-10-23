import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { rgba } from '../arena/canvas-math';
import { ZONE_COLORS } from '../arena/zone-look';
import { TranslationKey } from '../i18n/dictionaries';
import { playerNameText, renderGameText, zoneKey } from '../i18n/game-texts';
import { I18nService } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { TranslationParams } from '../i18n/translation';
import { ZONE_EFFECTS, ZoneKind } from '../state/zones';
import { AdSlotComponent } from '../support/ad-slot.component';
import { GameAds } from '../support/game-ads.service';
import { GameSupport } from '../support/game-support.service';
import { SupportCardComponent } from '../support/support-card.component';
import { ScreenHeaderComponent } from './screen-header.component';

const { agarDivideFactor, iceStayChance } = ZONE_EFFECTS;

/**
 * The game's privacy policy, on the game's own site: the Play listing links
 * to it as well, and inside the shell a relative link would miss it.
 */
export const PRIVACY_POLICY_URL = 'https://bacteria-wars.wolsok.de/privacy';

/**
 * The values each kind of ground's rule is filled with - every kind has
 * one. Agar's "twice" is a word of the active language, filled in below.
 */
const ZONE_PARAMS: Readonly<Record<ZoneKind, TranslationParams>> = {
  agar: {},
  antibiotic: {},
  ice: { percent: Math.round((1 - iceStayChance) * 100) },
  heat: {},
  hill: {},
};

/**
 * How to play: the rules in three steps, the ground some levels lay out,
 * the keys and the touch layout - where the privacy policy is, and how
 * to support the game.
 */
@Component({
  selector: 'feat-lazy-bac-game-help',
  imports: [
    AdSlotComponent,
    MatButtonModule,
    ScreenHeaderComponent,
    SupportCardComponent,
    TranslatePipe,
  ],
  templateUrl: './help.component.html',
  styleUrl: './help.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HelpComponent {
  private readonly i18n = inject(I18nService);

  /** The names of the left and the right colour, for the keys. */
  public readonly colorNames = input.required<readonly string[]>();

  public readonly back = output<void>();

  protected readonly privacyPolicyUrl = PRIVACY_POLICY_URL;
  protected readonly ads = inject(GameAds);
  protected readonly support = inject(GameSupport);

  /** The colours' names in the active language. */
  protected readonly names = computed(() =>
    this.colorNames().map((name) => {
      const text = playerNameText(name);
      return text === null
        ? name
        : renderGameText(text, (key, params) => this.i18n.t(key, params));
    })
  );

  /** What each kind of ground does, for the rules - every kind has one. */
  protected readonly zones = computed(() => {
    // "twice", "3 times".
    const times =
      agarDivideFactor === 2
        ? this.i18n.t('help.ground.twice')
        : this.i18n.t('help.ground.times', { count: agarDivideFactor });
    return (Object.keys(ZONE_PARAMS) as ZoneKind[]).map((kind) => ({
      kind,
      name: zoneKey(kind),
      rule: `help.ground.rules.${kind}` satisfies TranslationKey,
      params: kind === 'agar' ? { times } : ZONE_PARAMS[kind],
      css: rgba(ZONE_COLORS[kind]),
    }));
  });
}
