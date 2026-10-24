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
import type { Rgb } from '../arena/arena-theme';
import { rgba } from '../arena/canvas-math';
import { EvolutionService } from '../evolution.service';
import { GameHapticsService } from '../haptics.service';
import { TranslationKey } from '../i18n/dictionaries';
import { I18nService } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { TranslationParams } from '../i18n/translation';
import { GameSoundService } from '../sound/game-sound.service';
import {
  GENES,
  GeneId,
  MAX_GENE_LEVEL,
  WEAPONS,
  WeaponId,
} from '../state/evolution';
import { spentDna } from '../state/evolution-progress';
import { WeaponDemoComponent } from './weapon-demo.component';
import { ColonyPreviewComponent } from './colony-preview.component';
import { DnaHelixComponent } from './dna-helix.component';
import { celebrate } from './evolution-fx';
import {
  GENE_COLORS,
  genePercent,
  geneKeys,
  MAXED_COLOR,
  WEAPON_COLORS,
  weaponKeys,
} from './evolution-look';
import { ScreenHeaderComponent } from './screen-header.component';

/** The level pips of a gene card. */
const PIPS = Array.from({ length: MAX_GENE_LEVEL }, (_, index) => index);

/** A line for the screen reader, and its params. */
interface Announcement {
  key: TranslationKey;
  params: TranslationParams;
}

/**
 * Where the player evolves their colony with the DNA their XP has earned:
 * five genes of five levels and five weapons to carry into a match, a live
 * preview of the colony as bred, and a free reset (ADR 0013).
 *
 * Every purchase is a moment: strands of DNA fly from the counter into
 * what was bought, which bursts with light while the screen flashes and
 * shakes and a chime rises - the new level's pip fills only as they land.
 */
@Component({
  selector: 'feat-lazy-bac-game-evolution',
  imports: [
    ColonyPreviewComponent,
    DnaHelixComponent,
    MatButtonModule,
    MatIconModule,
    ScreenHeaderComponent,
    TranslatePipe,
    WeaponDemoComponent,
  ],
  templateUrl: './evolution.component.html',
  styleUrl: './evolution.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EvolutionComponent {
  protected readonly evolution = inject(EvolutionService);
  private readonly sound = inject(GameSoundService);
  private readonly haptics = inject(GameHapticsService);
  private readonly i18n = inject(I18nService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** The colour of the player's colony, for the preview. */
  public readonly color = input<Rgb>([255, 120, 40]);

  public readonly back = output<void>();

  private readonly counter =
    viewChild.required<ElementRef<HTMLElement>>('counter');
  private readonly fx = viewChild.required<ElementRef<HTMLElement>>('fx');
  private readonly preview = viewChild(ColonyPreviewComponent);

  protected readonly pips = PIPS;
  /** The bacteria of a weapon's little demo - every other one an enemy. */
  protected readonly maxLevel = MAX_GENE_LEVEL;

  /** Levels bought whose strands are still flying, by gene - not shown yet. */
  private readonly inFlight = signal<Partial<Record<GeneId, number>>>({});
  /**
   * The cards whose purchase is under way - its strands still flying. A
   * click on one of them buys nothing more, so a double click buys once.
   */
  private readonly buying = new Set<GeneId | WeaponId>();
  /** True while the reset asks to be confirmed. */
  protected readonly confirmingReset = signal(false);
  private readonly announcement = signal<Announcement | null>(null);

  /** The last purchase, for a screen reader. */
  protected readonly announced = computed(() => {
    const line = this.announcement();
    return line === null ? '' : this.i18n.t(line.key, line.params);
  });

  /** A card per gene: what it does now and next, and whether it can be bought. */
  protected readonly genes = computed(() => {
    const held = this.evolution.evolution();
    const flying = this.inFlight();
    return GENES.map((gene) => {
      const level = held.genes[gene.id] ?? 0;
      const cost = this.evolution.geneCost(gene.id);
      return {
        id: gene.id,
        icon: gene.icon,
        ...geneKeys(gene.id),
        level,
        shown: Math.max(0, level - (flying[gene.id] ?? 0)),
        percent: genePercent(gene, level),
        nextPercent: cost === null ? null : genePercent(gene, level + 1),
        cost,
        canBuy: this.evolution.canBuyGene(gene.id),
        maxed: level >= MAX_GENE_LEVEL,
        css: rgba(level >= MAX_GENE_LEVEL ? MAXED_COLOR : GENE_COLORS[gene.id]),
      };
    });
  });

  /** A card per weapon: owned, carried, its numbers and its price. */
  protected readonly weapons = computed(() => {
    const held = this.evolution.evolution();
    return WEAPONS.map((weapon) => ({
      id: weapon.id,
      icon: weapon.icon,
      ...weaponKeys(weapon.id),
      cooldown: weapon.cooldownSec,
      radius: weapon.radius,
      duration: weapon.durationSec,
      cost: this.evolution.weaponCost(weapon.id),
      owned: held.weapons.includes(weapon.id),
      equipped: held.equipped === weapon.id,
      canBuy: this.evolution.canBuyWeapon(weapon.id),
      css: rgba(WEAPON_COLORS[weapon.id]),
    }));
  });

  /** The weapon carried, for the badge under the preview. */
  protected readonly carried = computed(
    () => this.weapons().find((weapon) => weapon.equipped) ?? null
  );

  /** True while there is nothing to reset. */
  protected readonly nothingHeld = computed(
    () => spentDna(this.evolution.evolution()) === 0
  );

  protected async buyGene(id: GeneId): Promise<void> {
    if (this.buying.has(id) || !this.evolution.buyGene(id)) {
      return;
    }
    this.buying.add(id);
    const level = this.evolution.level(id);
    const maxed = level >= MAX_GENE_LEVEL;
    const name = { key: geneKeys(id).name };
    this.announcement.set({
      key: maxed ? 'evolution.announce.maxed' : 'evolution.announce.gene',
      params: { name: this.i18n.t(name.key), level },
    });
    this.inFlight.update((flying) => ({
      ...flying,
      [id]: (flying[id] ?? 0) + 1,
    }));
    this.sound.evolve(level, maxed);
    const pip = this.host.nativeElement.querySelector(
      `[data-pip="${id}-${level - 1}"]`
    );
    const color = maxed ? MAXED_COLOR : GENE_COLORS[id];
    try {
      if (pip !== null) {
        await this.celebrate(pip, color, maxed);
      }
    } finally {
      this.buying.delete(id);
      this.inFlight.update((flying) => ({
        ...flying,
        [id]: Math.max(0, (flying[id] ?? 1) - 1),
      }));
    }
    this.landed(color, maxed);
  }

  protected async buyWeapon(id: WeaponId): Promise<void> {
    if (this.buying.has(id) || !this.evolution.buyWeapon(id)) {
      return;
    }
    this.buying.add(id);
    this.announcement.set({
      key: 'evolution.announce.weapon',
      params: { name: this.i18n.t(weaponKeys(id).name) },
    });
    this.sound.evolve(1);
    const card = this.host.nativeElement.querySelector(
      `[data-weapon-demo="${id}"]`
    );
    try {
      if (card !== null) {
        await this.celebrate(card, WEAPON_COLORS[id], false);
      }
    } finally {
      this.buying.delete(id);
    }
    this.landed(WEAPON_COLORS[id], false);
  }

  /** Carries a weapon into the next match - or puts the carried one away. */
  protected toggleEquip(id: WeaponId): void {
    const on = this.evolution.equipped() !== id;
    this.evolution.equip(on ? id : null);
    this.sound.equip(on);
    this.haptics.tap();
    this.announcement.set(
      on
        ? {
            key: 'evolution.announce.equipped',
            params: { name: this.i18n.t(weaponKeys(id).name) },
          }
        : { key: 'evolution.announce.unequipped', params: {} }
    );
  }

  protected reset(): void {
    const back = spentDna(this.evolution.evolution());
    this.evolution.reset();
    this.confirmingReset.set(false);
    this.sound.devolve();
    this.haptics.tap();
    this.announcement.set({
      key: 'evolution.announce.reset',
      params: { count: back },
    });
  }

  private celebrate(to: Element, color: Rgb, maxed: boolean): Promise<void> {
    return celebrate(this.fx().nativeElement, this.host.nativeElement, {
      from: this.counter().nativeElement,
      to,
      color,
      maxed,
    });
  }

  /** The strands have landed: the colony lights up, the phone kicks. */
  private landed(color: Rgb, maxed: boolean): void {
    this.haptics.evolve(maxed);
    this.preview()?.celebrate(color);
  }
}
