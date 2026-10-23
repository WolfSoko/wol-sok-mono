import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { rankKey } from '../i18n/game-texts';
import { TranslatePipe } from '../i18n/translate.pipe';
import { rankFor, RANKS } from '../state/ranks';
import { RankBadgeComponent } from './rank-badge.component';

/**
 * Where an XP count stands: the rank's emblem and name, the XP and the bar
 * towards the next rank. The main menu's card and the profile show it.
 */
@Component({
  selector: 'feat-lazy-bac-game-rank-standing',
  imports: [MatProgressBarModule, RankBadgeComponent, TranslatePipe],
  template: `
    @let rank = standing();
    @let name = rankKey(rank.rank.id) | t;
    <div class="rank">
      <feat-lazy-bac-game-rank-badge
        [name]="name"
        [number]="rank.number"
        [size]="badgeSize()"
      />
      <span class="rank-text">
        <span class="rank-label">{{
          'match.rank.of' | t: { number: rank.number, count: rankCount }
        }}</span>
        <span class="rank-name">{{ name }}</span>
      </span>
    </div>
    <span class="xp-line">
      <span>{{ 'match.rank.xp' | t: { xp: xp() } }}</span>
      @if (rank.next; as next) {
        <span>{{
          'match.rank.toNext'
            | t: { xp: rank.toNext ?? 0, rank: (rankKey(next.id) | t) }
        }}</span>
      }
    </span>
    <mat-progress-bar
      class="bar"
      mode="determinate"
      [attr.aria-label]="'match.rank.bar' | t"
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
  protected readonly rankKey = rankKey;
}
