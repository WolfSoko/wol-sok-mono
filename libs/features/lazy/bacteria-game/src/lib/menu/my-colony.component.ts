import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { LookPreviewComponent } from '../arena/look-preview.component';
import { HERO_PREVIEW } from '../arena/look-preview';
import {
  ColonyColorsComponent,
  ColorChange,
} from '../colony-colors/colony-colors.component';
import { EvolutionService } from '../evolution.service';
import { GameHapticsService } from '../haptics.service';
import { TranslationKey } from '../i18n/dictionaries';
import { I18nService } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { GameSettingsService } from '../settings.service';
import { GameSoundService } from '../sound/game-sound.service';
import { getColonyColor } from '../state/colony-colors';
import { GameMode } from '../state/game.states';
import { BacteriaLook, SKINS } from '../state/skins';
import { DnaCounterComponent } from './dna-counter.component';
import { DnaHelixComponent } from './dna-helix.component';
import { celebrate } from './evolution-fx';
import { ScreenHeaderComponent } from './screen-header.component';

/**
 * The My Colony screen: the player's colony as it will look in the dish,
 * the skin it wears - the free ones and the ones to buy with DNA, each
 * shown on a sample colony in the player's colour - and the colonies'
 * colours. More of the colony is to be shaped here in time.
 *
 * A skin bought is a moment like a purchase on the Evolution screen:
 * strands fly from the DNA counter into the skin, which the colony wears
 * from then on.
 */
@Component({
  selector: 'feat-lazy-bac-game-my-colony',
  imports: [
    ColonyColorsComponent,
    DnaCounterComponent,
    DnaHelixComponent,
    LookPreviewComponent,
    MatButtonModule,
    MatIconModule,
    ScreenHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './my-colony.component.html',
  styleUrl: './my-colony.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyColonyComponent {
  protected readonly settings = inject(GameSettingsService);
  protected readonly evolution = inject(EvolutionService);
  private readonly sound = inject(GameSoundService);
  private readonly haptics = inject(GameHapticsService);
  private readonly i18n = inject(I18nService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  public readonly mode = input.required<GameMode>();
  /** The colour ids of the left and the right colony - the player's first. */
  public readonly colors = input.required<readonly [string, string]>();
  /** True while a match is on: the colours wait for the next. */
  public readonly locked = input(false);
  /** Why each colony colour still to earn is locked, by colour id. */
  public readonly colorLocks = input<Readonly<Record<string, string>>>({});

  public readonly colorChange = output<ColorChange>();
  public readonly back = output<void>();

  private readonly counter = viewChild.required('counter', {
    read: ElementRef<HTMLElement>,
  });
  private readonly fx = viewChild.required<ElementRef<HTMLElement>>('fx');

  protected readonly heroSize = HERO_PREVIEW;
  /** The skins whose purchase is under way - a double tap buys once. */
  private readonly buying = new Set<BacteriaLook>();
  /** The last purchase, for a screen reader. */
  protected readonly announced = signal('');

  /** A tile per skin: its name, its price and whether it is owned or affordable. */
  protected readonly skins = computed(() =>
    SKINS.map(({ id, cost }) => ({
      id,
      label: `colony.skin.names.${id}` satisfies TranslationKey,
      cost,
      owned: this.evolution.ownsSkin(id),
      canBuy: this.evolution.canBuySkin(id),
    }))
  );
  /** The skin the colonies wear: the one picked, once it is owned. */
  protected readonly worn = computed(() =>
    this.evolution.wornSkin(this.settings.look())
  );
  /** The player's colour, RGB. */
  protected readonly playerRgb = computed(
    () => getColonyColor(this.colors()[0]).rgb
  );
  /** The name of the skin worn, in the active language. */
  protected readonly skinName = computed(() =>
    this.i18n.t(`colony.skin.names.${this.worn()}`)
  );

  /** Buys a skin and wears it right away. */
  protected async buy(id: BacteriaLook): Promise<void> {
    if (this.buying.has(id) || !this.evolution.buySkin(id)) {
      return;
    }
    this.buying.add(id);
    this.settings.setLook(id);
    const name = this.i18n.t(`colony.skin.names.${id}`);
    this.announced.set(this.i18n.t('colony.announce.bought', { name }));
    this.sound.evolve(1);
    this.haptics.evolve();
    const tile = this.host.nativeElement.querySelector(`[data-skin="${id}"]`);
    try {
      if (tile !== null) {
        await celebrate(this.fx().nativeElement, this.host.nativeElement, {
          from: this.counter().nativeElement,
          to: tile,
          color: this.playerRgb(),
        });
      }
    } finally {
      this.buying.delete(id);
    }
  }
}
