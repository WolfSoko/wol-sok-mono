import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { rankFor, RANKS } from '../state/ranks';
import { RankBadgeComponent } from './rank-badge.component';

/**
 * Where an XP count stands: the rank's emblem and name, the XP and the bar
 * towards the next rank. The main menu's card and the profile show it.
 */
@Component({
  selector: 'feat-lazy-bac-game-rank-standing',
  imports: [MatProgressBarModule, RankBadgeComponent],
  template: `
    @let rank = standing();
    <div class="rank">
      <feat-lazy-bac-game-rank-badge
        [name]="rank.rank.name"
        [number]="rank.number"
        [size]="badgeSize()"
      />
      <span class="rank-text">
        <span class="rank-label"
          >Rank {{ rank.number }} of {{ rankCount }}</span
        >
        <span class="rank-name">{{ rank.rank.name }}</span>
      </span>
    </div>
    <span class="xp-line">
      <span>{{ xp().toLocaleString('en') }} XP</span>
      @if (rank.next; as next) {
        <span>{{ rank.toNext?.toLocaleString('en') }} to {{ next.name }}</span>
      }
    </span>
    <mat-progress-bar
      class="bar"
      mode="determinate"
      aria-label="XP to the next rank"
      [value]="100 * rank.progress"
    />
  `,
  styleUrl: './rank-standing.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RankStandingComponent {
  public readonly xp = input.required<number>();
  /** The emblem's width and height in CSS pixels. */
  public readonly badgeSize = input(64);

  protected readonly standing = computed(() => rankFor(this.xp()));
  protected readonly rankCount = RANKS.length;
}
