import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslatePipe } from '../i18n/translate.pipe';
import { AchievementTally } from './achievement-tally';

/**
 * How far the player got with the achievements: a trophy, "3 of 15" and a
 * bar, with what the host puts above the count. The player card shows it
 * small, the achievements screen `large`.
 */
@Component({
  selector: 'feat-lazy-bac-game-achievement-count',
  imports: [MatIconModule, MatProgressBarModule, TranslatePipe],
  template: `
    @let count = tally();
    <mat-icon class="trophy" aria-hidden="true">emoji_events</mat-icon>
    <span class="text">
      <ng-content />
      <span class="count"
        ><span class="earned">{{ count.earned }}</span
        >{{ ' '
        }}<span class="of">{{
          'common.of' | t: { total: count.total }
        }}</span></span
      >
      <mat-progress-bar
        class="bar"
        mode="determinate"
        [attr.aria-label]="'profile.achievements.progress' | t"
        [value]="count.percent"
      />
    </span>
  `,
  styles: `
    @use 'screen';

    :host {
      --trophy-size: 2.25rem;
      --count-size: 1.15rem;

      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    :host(.large) {
      --trophy-size: 3rem;
      --count-size: 2rem;

      gap: 1rem;
    }

    .trophy {
      flex: 0 0 auto;
      width: var(--trophy-size);
      height: var(--trophy-size);
      font-size: var(--trophy-size);
      color: var(--bw-gold);
      filter: drop-shadow(
        0 0 10px color-mix(in srgb, var(--bw-gold) 45%, transparent)
      );
    }

    .text {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
    }

    .earned {
      @include screen.figure;

      font-size: var(--count-size);
    }

    .of {
      font-weight: 600;
      color: var(--bw-muted);
    }

    .bar {
      @include screen.bar;
    }

    :host(:not(.large)) .bar {
      --mat-progress-bar-track-height: 0.35rem;
      --mat-progress-bar-active-indicator-height: 0.35rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.large]': 'large()' },
})
export class AchievementCountComponent {
  /** How far the player got with the achievements. */
  public readonly tally = input.required<AchievementTally>();
  /** The achievements screen's size, rather than the player card's. */
  public readonly large = input(false);
}
