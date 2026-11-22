import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { rankFor } from '@wolsok/feat-shared-bacteria-engine';
import { rankKey } from '../i18n/game-texts';
import { TranslatePipe } from '../i18n/translate.pipe';
import { RankBadgeComponent } from '../rank/rank-badge.component';
import { RankStandingComponent } from '../rank/rank-standing.component';
import { AvatarComponent } from '../social/avatar.component';
import { SocialService } from '../social/social.service';

/**
 * The top of the profile, the player as the game shows them: their picture
 * in a dish of their colony's colour with the rank's emblem pinned to it,
 * their name and motto as saved, the rank with the way to the next, and the
 * way to their achievements. Without the cloud there is no picture or name:
 * the emblem and "Your colony" stand in.
 */
@Component({
  selector: 'feat-lazy-bac-game-profile-card',
  imports: [
    AvatarComponent,
    MatIconModule,
    RankBadgeComponent,
    RankStandingComponent,
    TranslatePipe,
  ],
  templateUrl: './profile-card.component.html',
  styleUrl: './profile-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileCardComponent {
  /** The saved profile - null without the cloud. */
  protected readonly player = inject(SocialService).profile;

  /** The XP the progress is worth. */
  public readonly xp = input.required<number>();
  /** How many achievements the player earned. */
  public readonly earned = input.required<number>();
  /** How many achievements the game has. */
  public readonly total = input.required<number>();

  /** Opens the achievements. */
  public readonly achievements = output<void>();

  protected readonly standing = computed(() => rankFor(this.xp()));
  protected readonly rankKey = rankKey;

  /** The share of the achievements earned, in percent. */
  protected readonly earnedPercent = computed(() =>
    this.total() === 0 ? 0 : (100 * this.earned()) / this.total()
  );
}
