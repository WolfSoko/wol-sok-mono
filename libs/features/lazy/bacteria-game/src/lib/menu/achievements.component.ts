import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import {
  ACHIEVEMENTS,
  achievementTally,
  Progress,
} from '@wolsok/feat-shared-bacteria-engine';
import {
  achievementKeys,
  achievementTexts,
  GameTextPipe,
} from '../i18n/game-texts';
import { I18nService } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { AchievementCountComponent } from './achievement-count.component';
import { ScreenHeaderComponent } from './screen-header.component';

/**
 * Every achievement of the game, opened from the profile: the earned ones
 * with their day, the rest locked, with what earns them.
 */
@Component({
  selector: 'feat-lazy-bac-game-achievements',
  imports: [
    AchievementCountComponent,
    GameTextPipe,
    MatIconModule,
    ScreenHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './achievements.component.html',
  styleUrl: './achievements.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AchievementsComponent {
  private readonly i18n = inject(I18nService);

  /** The day each achievement was earned. */
  public readonly achievements = input<Progress['achievements']>({});

  /** Names where the way back leads - the profile, where the screen opens. */
  public readonly backLabel = input.required<string>();

  /** Back to the profile, where the screen was opened. */
  public readonly back = output<void>();

  /** Every achievement, earned ones with their day, the rest with their condition. */
  protected readonly achievementList = computed(() =>
    ACHIEVEMENTS.map(({ id }) => ({
      id,
      name: achievementKeys(id).name,
      condition: achievementTexts(id).condition,
      earnedOn: this.achievements()[id] ?? null,
    }))
  );

  /** How many are earned, of how many, and the share. */
  protected readonly tally = computed(() =>
    achievementTally(this.achievements())
  );

  /** A day as the screen shows it - "19 Oct 2026" - for the locale. */
  protected readonly formatDay = computed(() => {
    const format = new Intl.DateTimeFormat(this.i18n.locale(), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
    // The day is kept as "2026-10-19", the player's own calendar day.
    return (day: string): string => {
      const [year, month, date] = day.split('-').map(Number);
      return format.format(new Date(Date.UTC(year, month - 1, date)));
    };
  });
}
