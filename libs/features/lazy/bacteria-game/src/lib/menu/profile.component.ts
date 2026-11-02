import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import {
  achievementKeys,
  achievementTexts,
  difficultyKeys,
  GameTextPipe,
  levelNameText,
  medalKey,
  rankKey,
} from '../i18n/game-texts';
import { I18nService } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { MedallionComponent } from '../medallion/medallion.component';
import { AccountComponent } from './account.component';
import { ScreenHeaderComponent } from './screen-header.component';
import { ProfileEditorComponent } from '../social/profile-editor.component';
import { SocialService } from '../social/social.service';
import { BOT_DIFFICULTIES } from '../state/bot-controller';
import { LEVELS } from '../state/levels';
import { MEDAL_TIERS_RAREST_FIRST } from '../state/medallions';
import { ACHIEVEMENTS } from '../state/achievements';
import { rankFor, RANKS } from '../state/ranks';
import { dnaEarned } from '../state/evolution';
import { RankStandingComponent } from '../rank/rank-standing.component';
import { AdSlotComponent } from '../support/ads/ad-slot.component';
import {
  LifetimeTotals,
  medalTally,
  NO_TOTALS,
  Progress,
} from '../state/progress';

/**
 * The player's profile: what they have done over all their matches, every
 * medallion won, level by level and difficulty by difficulty, and the
 * achievements, earned or still to earn - and where it is all kept.
 */
@Component({
  selector: 'feat-lazy-bac-game-profile',
  imports: [
    AccountComponent,
    AdSlotComponent,
    GameTextPipe,
    MedallionComponent,
    ProfileEditorComponent,
    RankStandingComponent,
    ScreenHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileComponent {
  /** The online profile is edited here, where the game has its cloud. */
  protected readonly social = inject(SocialService);
  private readonly i18n = inject(I18nService);
  /** The locale the figures are written for. */
  protected readonly locale = this.i18n.locale;

  /** Every medallion held, by level id, then by difficulty. */
  public readonly medals = input<Progress['medals']>({});
  /** The day each achievement was earned. */
  public readonly achievements = input<Progress['achievements']>({});
  /** What the player has done over all their matches. */
  public readonly totals = input<LifetimeTotals>(NO_TOTALS);
  /** The XP the progress is worth. */
  public readonly xp = input(0);

  public readonly back = output<void>();

  protected readonly difficulties = BOT_DIFFICULTIES.map(({ id }) => ({
    id,
    name: difficultyKeys(id).name,
  }));

  /** A row per level, a medallion or an empty slot per difficulty. */
  protected readonly cabinet = computed(() =>
    LEVELS.map((level) => ({
      id: level.id,
      name: levelNameText(level),
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
      name: medalKey(tier),
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

  /** The rank the XP has reached, and the way to the next. */
  protected readonly standing = computed(() => rankFor(this.xp()));
  /** All the DNA the XP has grown, spent or not. */
  protected readonly dna = computed(() => dnaEarned(this.xp()));
  protected readonly ranks = RANKS.map(({ id }) => ({ id, name: rankKey(id) }));

  /** Every achievement, earned ones with their day, the rest with their condition. */
  protected readonly achievementList = computed(() =>
    ACHIEVEMENTS.map(({ id }) => ({
      id,
      name: achievementKeys(id).name,
      condition: achievementTexts(id).condition,
      earnedOn: this.achievements()[id] ?? null,
    }))
  );

  /** A day as the profile shows it - "19 Oct 2026" - for the locale. */
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

  protected readonly earnedCount = computed(
    () => Object.keys(this.achievements()).length
  );

  protected readonly achievementCount = ACHIEVEMENTS.length;
}
