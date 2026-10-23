import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BOT_DIFFICULTIES } from '../state/bot-controller';
import { ACHIEVEMENTS } from '../state/achievements';
import { CampaignSummary } from '../state/campaign';
import { RankStandingComponent } from '../rank/rank-standing.component';
import { Level, LEVELS } from '../state/levels';
import { GhostChallengeComponent } from '../ghost/ghost-challenge.component';
import { MEDAL_NAMES, MEDAL_TIERS_RAREST_FIRST } from '../state/medallions';
import { GameSupport } from '../support/game-support.service';
import {
  SUPPORT_DIALOG_HEADING_ID,
  SupportDialogComponent,
} from '../support/support-dialog.component';

/** The sub screens the main menu opens. */
export type MenuPage = 'profile' | 'settings' | 'help';

/**
 * The landing screen of the fullscreen game: the title, a new game, the
 * way to the other screens and a card with the campaign so far - and the
 * way straight on with it.
 *
 * A dumb component - it shows what it is given and reports what the player
 * picks. Only the way to support the game it finds itself, as it differs
 * between the web and the Play Store app.
 */
@Component({
  selector: 'feat-lazy-bac-game-main-menu',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatTooltipModule,
    RankStandingComponent,
    GhostChallengeComponent,
  ],
  templateUrl: './main-menu.component.html',
  styleUrl: './main-menu.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainMenuComponent {
  public readonly campaign = input.required<CampaignSummary>();
  public readonly sound = input(true);
  /** The level of a run someone shared, to fight as a ghost - null without. */
  public readonly challenge = input<Level | null>(null);

  /** A new game, to set up step by step. */
  public readonly newGame = output<void>();
  /** Straight into the furthest level the campaign has opened. */
  public readonly continueCampaign = output<void>();
  public readonly open = output<MenuPage>();
  public readonly soundChange = output<boolean>();
  /** Back to the page around the game. */
  public readonly leave = output<void>();
  public readonly fightChallenge = output<void>();
  public readonly dismissChallenge = output<void>();

  protected readonly medalCount = computed(() =>
    Object.values(this.campaign().medals).reduce((sum, n) => sum + n, 0)
  );

  protected readonly names = MEDAL_NAMES;
  protected readonly tiers = MEDAL_TIERS_RAREST_FIRST;
  protected readonly totalLevels = LEVELS.length;
  protected readonly totalMedals = LEVELS.length * BOT_DIFFICULTIES.length;
  protected readonly totalAchievements = ACHIEVEMENTS.length;

  protected readonly support = inject(GameSupport);
  private readonly dialog = inject(MatDialog);

  /** The Play tips, in the app, where the Buy Me a Coffee page is not allowed. */
  protected openTips(): void {
    this.dialog.open(SupportDialogComponent, {
      maxWidth: '30rem',
      ariaLabelledBy: SUPPORT_DIALOG_HEADING_ID,
    });
  }
}
