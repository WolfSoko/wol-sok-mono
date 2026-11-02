import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  OutputEmitterRef,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { injectGameAnalytics } from '../analytics/game-analytics';
import { StageBusy } from '../busy/stage-busy';
import { FeatureTogglesService } from '../feature-toggles.service';
import { GameTextPipe, medalKey } from '../i18n/game-texts';
import { TranslatePipe } from '../i18n/translate.pipe';
import { BOT_DIFFICULTIES } from '../state/bot-controller';
import { ACHIEVEMENTS } from '../state/achievements';
import { CampaignSummary } from '../state/campaign';
import { MISSIONS } from '../state/training';
import { RankStandingComponent } from '../rank/rank-standing.component';
import { Level, LEVELS } from '../state/levels';
import { GhostChallengeComponent } from '../ghost/ghost-challenge.component';
import { DnaHelixComponent } from './dna-helix.component';
import { MEDAL_TIERS_RAREST_FIRST } from '../state/medallions';
import { GameAccount } from '../storage/game-account';
import { GAME_SUPPORT } from '../support/game-support';
import { GameSupport } from '../support/game-support.service';
import { AccountChipComponent } from '../guest/account-chip.component';
import { GuestBannerComponent } from '../guest/guest-banner.component';
import { GuestNotice } from '../guest/guest-notice.service';
import { InstallBannerComponent } from '../support/install-banner.component';
import { StatsBannerComponent } from '../analytics/stats-banner.component';
import { StatsConsent } from '../analytics/stats-consent.service';
import { InstallOffer } from '../support/install-offer.service';
import { ADMIN_PATH } from '../support/legal-links';
import { SiteFooterComponent } from '../support/site-footer.component';
import {
  SUPPORT_DIALOG_HEADING_ID,
  SupportDialogComponent,
} from '../support/support-dialog.component';

/** The sub screens the main menu opens. */
export type MenuPage =
  | 'colony'
  | 'profile'
  | 'friends'
  | 'settings'
  | 'help'
  | 'evolution'
  | 'leaderboards'
  | 'my-matches';

/**
 * The landing screen of the game: the title, a new game - and the training
 * until its missions are done - the way to the other screens and a card
 * with the campaign so far, and the way straight on with it.
 *
 * A dumb component - it shows what it is given and reports what the player
 * picks. Only the way to support the game it finds itself, as it differs
 * between the web and the Play Store app; who plays, with a guest's way to
 * sign in and, from the third day, the notice that an unused guest account
 * is deleted; and, on the game's own site, the offer to install it, the
 * legal lines under everything and, for the owner, the way to the admin
 * area.
 */
@Component({
  selector: 'feat-lazy-bac-game-main-menu',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatTooltipModule,
    RankStandingComponent,
    RouterLink,
    GhostChallengeComponent,
    DnaHelixComponent,
    InstallBannerComponent,
    StatsBannerComponent,
    AccountChipComponent,
    GuestBannerComponent,
    SiteFooterComponent,
    TranslatePipe,
    GameTextPipe,
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
  /**
   * True with the game's cloud: then the friends have a tile, and so do the
   * leaderboards while the owner's toggle shows them.
   */
  public readonly cloudAvailable = input(false);
  /** The friend requests waiting for an answer, counted on the tile. */
  public readonly friendRequests = input(0);
  /**
   * The DNA left to spend while it buys something - the badge on the
   * Evolution tile - 0 while it buys nothing.
   */
  public readonly evolveDna = input(0);
  /** The DNA left while it buys a skin - the badge on the My Colony tile - 0 otherwise. */
  public readonly colonyDna = input(0);
  /** True while the game fills the whole screen rather than its page. */
  public readonly fullscreen = input(false);
  /** The training missions done - the way to the training shows until all are. */
  public readonly missionsDone = input(0);

  /** A new game, to set up step by step. */
  public readonly newGame = output<void>();
  /** Straight into the furthest level the campaign has opened. */
  public readonly continueCampaign = output<void>();
  /** To the training's missions. */
  public readonly training = output<void>();
  public readonly open = output<MenuPage>();
  public readonly soundChange = output<boolean>();
  /** Onto the whole screen (true) or back into the page (false). */
  public readonly fullscreenChange = output<boolean>();
  public readonly fightChallenge = output<void>();
  public readonly dismissChallenge = output<void>();

  private readonly busy = inject(StageBusy);

  /**
   * Emits a way into a new game behind the stage's spinner: the screen it
   * opens takes a moment to lay out. A match is started behind it by the
   * stage, which takes the screen on the tap first.
   */
  protected busyEmit(output: OutputEmitterRef<void>): void {
    this.busy.run(() => output.emit());
  }

  protected readonly medalCount = computed(() =>
    Object.values(this.campaign().medals).reduce((sum, n) => sum + n, 0)
  );

  protected readonly medalKey = medalKey;
  protected readonly tiers = MEDAL_TIERS_RAREST_FIRST;
  protected readonly totalLevels = LEVELS.length;
  protected readonly totalMedals = LEVELS.length * BOT_DIFFICULTIES.length;
  protected readonly totalAchievements = ACHIEVEMENTS.length;
  protected readonly totalMissions = MISSIONS.length;

  private readonly toggles = inject(FeatureTogglesService).toggles;
  /** The leaderboards' tile: with the cloud, while the owner shows them. */
  protected readonly showsBoards = computed(
    () => this.cloudAvailable() && this.toggles().leaderboards
  );

  protected readonly support = inject(GameSupport);
  protected readonly installOffer = inject(InstallOffer);
  /** The guest's notice, which the install offer waits behind. */
  protected readonly guestNotice = inject(GuestNotice);
  protected readonly stats = inject(StatsConsent);
  /** True on the game's own site, where the support options are provided. */
  protected readonly onSite = inject(GAME_SUPPORT) !== null;
  private readonly account = inject(GameAccount);
  /**
   * True for the owner on the game's own site, the one with the admin
   * route - the shell has none.
   */
  protected readonly showsAdmin = computed(
    () => this.onSite && this.account.owner()
  );
  protected readonly adminPath = ADMIN_PATH;
  private readonly dialog = inject(MatDialog);
  private readonly analytics = injectGameAnalytics();

  /** The Play tips, in the app, where the Buy Me a Coffee page is not allowed. */
  protected openTips(): void {
    this.analytics.track('tip_dialog_opened');
    this.dialog.open(SupportDialogComponent, {
      maxWidth: '30rem',
      ariaLabelledBy: SUPPORT_DIALOG_HEADING_ID,
    });
  }
}
