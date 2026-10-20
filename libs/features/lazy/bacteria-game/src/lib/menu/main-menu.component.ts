import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { GameMode } from '../state/game.states';
import { BOT_DIFFICULTIES } from '../state/bot-controller';
import { ACHIEVEMENTS } from '../state/achievements';
import { CampaignSummary } from '../state/campaign';
import { RankStandingComponent } from '../rank/rank-standing.component';
import { Level, LEVELS } from '../state/levels';
import { GhostChallengeComponent } from '../ghost/ghost-challenge.component';
import { MEDAL_NAMES, MEDAL_TIERS_RAREST_FIRST } from '../state/medallions';

/** The sub screens the main menu opens. */
export type MenuPage = 'profile' | 'settings' | 'help';

/**
 * The landing screen of the fullscreen game: the title, Play for a match
 * against the computer, a match between two players, the way to the other
 * screens and a card with the campaign so far.
 *
 * A dumb component - it shows what it is given and reports what the player
 * picks.
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

  /** A match against the computer or between two players, to set up. */
  public readonly play = output<GameMode>();
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
}
