import {
  computed,
  effect,
  inject,
  Injectable,
  signal,
  untracked,
} from '@angular/core';
import { AchievementId } from '@wolsok/feat-shared-bacteria-engine';
import { injectGameAnalytics } from '../analytics/game-analytics';
import { ProgressService } from '../progress.service';
import { SocialService } from '../social/social.service';
import { GameAccount } from '../storage/game-account';
import { GuestNotice } from './guest-notice.service';
import { labPassSteps, nextStep } from './lab-pass';
import { SignIn } from './sign-in.service';

/** The achievement the completed pass earns. */
export const LAB_PASS_ACHIEVEMENT: AchievementId = 'lab-member';

/**
 * The Lab Pass in the main menu: its steps from what the game knows, the
 * achievement it earns once complete, and the profile's onboarding after a
 * sign-in. Only with the cloud: without it nobody signs in.
 */
@Injectable({ providedIn: 'root' })
export class LabPass {
  private readonly account = inject(GameAccount);
  private readonly social = inject(SocialService);
  private readonly progress = inject(ProgressService);
  private readonly notice = inject(GuestNotice);
  private readonly signIn = inject(SignIn);
  private readonly analytics = injectGameAnalytics();

  /** The pass's steps, each done or not. */
  public readonly steps = computed(() => {
    const player = this.account.profile();
    const saved =
      this.social.profileLoaded() && this.social.storedAvatar() !== null;
    return labPassSteps({
      signedIn: player !== null && !player.guest,
      profileSaved: saved,
      motto: saved && (this.social.profile()?.motto ?? '') !== '',
      friend: this.social.friends().length > 0,
    });
  });

  /** The first step still open, null once the pass is complete. */
  public readonly next = computed(() => nextStep(this.steps()));

  /** The steps done, for the dish's slots. */
  public readonly done = computed(
    () => this.steps().filter(({ done }) => done).length
  );

  /** True once this visit earned the pass's achievement. */
  private readonly earnedNow = signal(false);
  public readonly justEarned = this.earnedNow.asReadonly();

  /** True when the player holds the achievement, earned now or before. */
  private readonly held = computed(
    () => this.progress.achievements()[LAB_PASS_ACHIEVEMENT] != null
  );

  /**
   * True while the main menu shows the pass: with the cloud, once the
   * player is known and their progress loaded, until they hold its
   * achievement - and on, in this visit, to tell them they earned it.
   * "Later" puts it away for two weeks.
   */
  public readonly visible = computed(
    () =>
      this.account.cloud &&
      this.social.available &&
      this.account.profile() !== null &&
      this.progress.loaded() &&
      (this.earnedNow() || (!this.held() && !this.notice.dismissedLately()))
  );

  /** True while a guest should hear that an unused guest account is deleted. */
  public readonly urgent = this.notice.visible;

  /** The sign-ins already led to the profile. */
  private readonly onboarded = signal(0);
  /**
   * True when a sign-in of this visit brought a player without a profile
   * of their own: the main menu then opens the profile to make one.
   */
  public readonly onboardingDue = computed(
    () =>
      this.signIn.signIns() > this.onboarded() &&
      this.next() === 'profile' &&
      this.social.profileLoaded()
  );
  /** True while the profile editor welcomes a player who just signed in. */
  private readonly welcomingState = signal(false);
  public readonly welcoming = this.welcomingState.asReadonly();

  public constructor() {
    effect(() => {
      if (this.next() === null && this.progress.loaded() && !this.held()) {
        untracked(() => this.earn());
      }
    });
  }

  /** Puts the pass away for two weeks. */
  public dismiss(): void {
    this.earnedNow.set(false);
    this.notice.dismiss();
  }

  /** Closes the pass once its achievement was shown. */
  public close(): void {
    this.earnedNow.set(false);
  }

  /** The main menu opened the profile for the sign-in's onboarding. */
  public startOnboarding(): void {
    this.onboarded.set(this.signIn.signIns());
    this.welcomingState.set(true);
  }

  /** The profile editor has welcomed the player. */
  public endOnboarding(): void {
    this.welcomingState.set(false);
  }

  private earn(): void {
    if (this.progress.grantAchievement(LAB_PASS_ACHIEVEMENT)) {
      this.earnedNow.set(true);
      this.analytics.track('unlock_achievement', {
        achievement_id: LAB_PASS_ACHIEVEMENT,
      });
    }
  }
}
