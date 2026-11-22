import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import {
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
import { achievementTally } from './achievement-tally';
import { ProfileCardComponent } from './profile-card.component';
import { ScreenHeaderComponent } from './screen-header.component';
import { ProfileEditorComponent } from '../social/profile-editor.component';
import { SocialService } from '../social/social.service';
import {
  BOT_DIFFICULTIES,
  dnaEarned,
  LEVELS,
  LifetimeTotals,
  MEDAL_TIERS_RAREST_FIRST,
  medalTally,
  NO_TOTALS,
  Progress,
  rankFor,
  RANKS,
} from '@wolsok/feat-shared-bacteria-engine';
import { AdSlotComponent } from '../support/ads/ad-slot.component';

/**
 * The player's profile: their player card on top, which leads to the
 * achievements, the online profile with what others and the public see,
 * what they have done over all their matches, every medallion won, level
 * by level and difficulty by difficulty - and where it is all kept.
 */
@Component({
  selector: 'feat-lazy-bac-game-profile',
  imports: [
    AccountComponent,
    AdSlotComponent,
    GameTextPipe,
    MedallionComponent,
    ProfileCardComponent,
    ProfileEditorComponent,
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
  /** The locale the figures are written for. */
  protected readonly locale = inject(I18nService).locale;

  /** Every medallion held, by level id, then by difficulty. */
  public readonly medals = input<Progress['medals']>({});
  /** The day each achievement was earned. */
  public readonly achievements = input<Progress['achievements']>({});
  /** What the player has done over all their matches. */
  public readonly totals = input<LifetimeTotals>(NO_TOTALS);
  /** The XP the progress is worth. */
  public readonly xp = input(0);

  public readonly back = output<void>();
  /** Opens the achievements, from the player card. */
  public readonly openAchievements = output<void>();

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

  /** How far the player got with the achievements, for the player card. */
  protected readonly achievementTally = computed(() =>
    achievementTally(this.achievements())
  );
}
