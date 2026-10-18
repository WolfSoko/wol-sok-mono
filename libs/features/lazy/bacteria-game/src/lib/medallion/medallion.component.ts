import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { BotDifficulty, difficultyOption } from '../state/bot-controller';
import { MEDAL_NAMES, MedalTier } from '../state/medallions';

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
  /** The difficulty it was won at, shown as a chip - none on small ones. */
  public readonly difficulty = input<BotDifficulty | null>(null);

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
  protected readonly chip = computed(
    () => difficultyOption(this.difficulty())?.name[0] ?? null
  );
  protected readonly label = computed(() => {
    const tier = this.tier();
    return tier == null ? 'No medallion yet' : `${MEDAL_NAMES[tier]} medallion`;
  });
}
