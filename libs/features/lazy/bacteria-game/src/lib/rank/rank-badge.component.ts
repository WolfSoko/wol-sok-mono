import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { RANKS } from '../state/ranks';

/**
 * A rank's emblem: a gold hexagon around its initial, with a pip for every
 * rank climbed - the more pips, the higher.
 */
@Component({
  selector: 'feat-lazy-bac-game-rank-badge',
  template: `
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <polygon
        points="32,3 57,17.5 57,46.5 32,61 7,46.5 7,17.5"
        class="hexagon"
      />
      <text x="32" y="38" text-anchor="middle" class="initial">
        {{ name()[0] }}
      </text>
      @for (pip of pips(); track $index) {
        <circle [attr.cx]="pip" cy="49" r="1.8" class="pip" />
      }
    </svg>
  `,
  styleUrl: './rank-badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'img',
    '[attr.aria-label]': '"Rank: " + name()',
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
  },
})
export class RankBadgeComponent {
  public readonly name = input.required<string>();
  /** 1 for the first rank. */
  public readonly number = input.required<number>();
  /** Width and height in CSS pixels. */
  public readonly size = input(64);

  /**
   * The x of each pip, centred under the initial - eight of them still
   * inside the hexagon.
   */
  protected readonly pips = computed(() => {
    const count = Math.min(this.number(), RANKS.length);
    const gap = 4.4;
    return Array.from(
      { length: count },
      (_, i) => 32 + (i - (count - 1) / 2) * gap
    );
  });
}
