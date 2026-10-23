import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { difficultyKeys, medalKey } from '../i18n/game-texts';
import { I18nService } from '../i18n/i18n.service';
import { BotDifficulty, difficultyOption } from '../state/bot-controller';
import { MedalTier } from '../state/medallions';

/** Highlight, body and rim of each metal. */
const METALS: Record<MedalTier, readonly [string, string, string]> = {
  bronze: ['#ffd2a8', '#c4793a', '#6e3612'],
  silver: ['#ffffff', '#c3ccd6', '#5f6b7a'],
  gold: ['#fff4b8', '#f2c230', '#8a5c00'],
  platinum: ['#ffffff', '#d6f0ff', '#6f97b8'],
};

/** The bacteria embossed on a medallion, as x, y and radius: one more per tier. */
const CELLS: Record<MedalTier, readonly (readonly [number, number, number])[]> =
  {
    bronze: [[50, 50, 16]],
    silver: [
      [39, 50, 12],
      [61, 50, 12],
    ],
    gold: [
      [50, 38, 11],
      [39, 58, 11],
      [61, 58, 11],
    ],
    platinum: [
      [39, 39, 10],
      [61, 39, 10],
      [39, 61, 10],
      [61, 61, 10],
    ],
  };

let nextId = 0;

/** The smallest medallion, in CSS pixels, that carries a readable chip. */
const CHIP_MIN_SIZE = 40;

/**
 * A medallion drawn in code - a disc in the tier's metal with as many
 * bacteria embossed as the tier is high - or an empty slot while the level
 * has none. The same picture serves the level list and the result screen.
 */
@Component({
  selector: 'feat-lazy-bac-game-medallion',
  templateUrl: './medallion.component.html',
  styleUrl: './medallion.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'img',
    '[attr.aria-label]': 'label()',
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
  },
})
export class MedallionComponent {
  /** The medallion to show, null for an empty slot. */
  public readonly tier = input.required<MedalTier | null>();
  /** Width and height in CSS pixels. */
  public readonly size = input(24);
  /**
   * The difficulty it was won at: a chip on a big medallion, the letter in
   * an empty slot, and part of the label either way.
   */
  public readonly difficulty = input<BotDifficulty | null>(null);

  private readonly i18n = inject(I18nService);

  /** Keeps the gradients of several medallions on one page apart. */
  protected readonly id = `bac-medal-${nextId++}`;
  protected readonly metal = computed(() => {
    const tier = this.tier();
    return tier == null ? null : METALS[tier];
  });
  protected readonly cells = computed(() => {
    const tier = this.tier();
    return tier == null ? [] : CELLS[tier];
  });
  /** The difficulty's name in the active language, null without one. */
  private readonly difficultyName = computed(() => {
    const difficulty = difficultyOption(this.difficulty());
    return difficulty == null
      ? null
      : this.i18n.t(difficultyKeys(difficulty.id).name);
  });
  /** The difficulty's letter, null without one. */
  protected readonly letter = computed(
    () => this.difficultyName()?.[0] ?? null
  );
  /** The chip in the corner - too small to read on a small medallion. */
  protected readonly chip = computed(() =>
    this.size() >= CHIP_MIN_SIZE ? this.letter() : null
  );
  protected readonly label = computed(() => {
    const tier = this.tier();
    const medal =
      tier == null
        ? this.i18n.t('common.noMedal')
        : this.i18n.t('common.medal', {
            medal: this.i18n.t(medalKey(tier)),
          });
    const difficulty = this.difficultyName();
    return difficulty == null
      ? medal
      : this.i18n.t('match.medallion.withDifficulty', { medal, difficulty });
  });
}
