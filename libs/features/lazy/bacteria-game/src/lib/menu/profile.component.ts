import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MedallionComponent } from '../medallion/medallion.component';
import { BOT_DIFFICULTIES } from '../state/bot-controller';
import { LEVELS } from '../state/levels';
import { MEDAL_NAMES, MEDAL_TIERS } from '../state/medallions';
import { Progress } from '../state/progress';

/**
 * The player's profile: every medallion won, level by level and difficulty
 * by difficulty, and how many of each metal. Kept on this device.
 */
@Component({
  selector: 'feat-lazy-bac-game-profile',
  imports: [MatButtonModule, MatIconModule, MedallionComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileComponent {
  /** Every medallion held, by level id, then by difficulty. */
  public readonly medals = input<Progress['medals']>({});

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
    const held = this.cabinet().flatMap((row) => row.slots.map((s) => s.tier));
    return [...MEDAL_TIERS].reverse().map((tier) => ({
      tier,
      name: MEDAL_NAMES[tier],
      count: held.filter((t) => t === tier).length,
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
}
