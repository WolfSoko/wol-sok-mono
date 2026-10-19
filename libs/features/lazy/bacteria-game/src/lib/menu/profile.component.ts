import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { MedallionComponent } from '../medallion/medallion.component';
import { ScreenHeaderComponent } from './screen-header.component';
import { BOT_DIFFICULTIES } from '../state/bot-controller';
import { LEVELS } from '../state/levels';
import { MEDAL_NAMES, MEDAL_TIERS_RAREST_FIRST } from '../state/medallions';
import { ACHIEVEMENTS } from '../state/achievements';
import {
  LifetimeTotals,
  medalTally,
  NO_TOTALS,
  Progress,
} from '../state/progress';

/**
 * The player's profile: what they have done over all their matches, every
 * medallion won, level by level and difficulty by difficulty, and the
 * achievements, earned or still to earn. Kept on this device.
 */
@Component({
  selector: 'feat-lazy-bac-game-profile',
  imports: [DatePipe, MedallionComponent, ScreenHeaderComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileComponent {
  /** Every medallion held, by level id, then by difficulty. */
  public readonly medals = input<Progress['medals']>({});
  /** The day each achievement was earned. */
  public readonly achievements = input<Progress['achievements']>({});
  /** What the player has done over all their matches. */
  public readonly totals = input<LifetimeTotals>(NO_TOTALS);

  public readonly back = output<void>();

  protected readonly difficulties = BOT_DIFFICULTIES;

  /** A row per level, a medallion or an empty slot per difficulty. */
  protected readonly cabinet = computed(() =>
    LEVELS.map((level) => ({
      id: level.id,
      name: level.name,
      slots: BOT_DIFFICULTIES.map(({ id }) => ({
        difficulty: id,
        tier: this.medals()[level.id]?.[id] ?? null,
      })),
    }))
  );

  /** How many medallions of each metal, rarest first. */
  protected readonly tally = computed(() => {
    const tally = medalTally(this.medals());
    return MEDAL_TIERS_RAREST_FIRST.map((tier) => ({
      tier,
      name: MEDAL_NAMES[tier],
      count: tally[tier],
    }));
  });

  protected readonly heldCount = computed(() =>
    this.tally().reduce((sum, { count }) => sum + count, 0)
  );

  protected readonly totalCount = LEVELS.length * BOT_DIFFICULTIES.length;

  /** Levels won against the computer, at any difficulty. */
  protected readonly levelsWon = computed(
    () =>
      this.cabinet().filter((row) => row.slots.some((s) => s.tier !== null))
        .length
  );

  protected readonly levelCount = LEVELS.length;

  /** Every achievement, earned ones with their day, the rest with their condition. */
  protected readonly achievementList = computed(() =>
    ACHIEVEMENTS.map((achievement) => ({
      ...achievement,
      earnedOn: this.achievements()[achievement.id] ?? null,
    }))
  );

  protected readonly earnedCount = computed(
    () => Object.keys(this.achievements()).length
  );

  protected readonly achievementCount = ACHIEVEMENTS.length;
}
