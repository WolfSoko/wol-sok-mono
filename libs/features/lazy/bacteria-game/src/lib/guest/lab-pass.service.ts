import {
  computed,
  effect,
  inject,
  Injectable,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AchievementId } from '@wolsok/feat-shared-bacteria-engine';
import { injectGameAnalytics } from '../analytics/game-analytics';
import { ProgressService } from '../progress.service';
import { SocialService } from '../social/social.service';
import { GameAccount } from '../storage/game-account';
import { GuestNotice } from './guest-notice.service';
import { labPassSteps, nextStep } from './lab-pass';
import { SignIn } from './sign-in.service';

/** A field of the profile editor a step of the pass leads to. */
export type EditorField = 'name' | 'motto';

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
      // Nothing until the device and the profile have answered: a card put
      // away, or a step done, would flash up meanwhile.
      this.notice.known() &&
      this.social.profileLoaded() &&
      this.progress.loaded() &&
      (this.earnedNow() || (!this.held() && !this.notice.dismissedLately()))
  );

  /** True while a guest should hear that an unused guest account is deleted. */
  public readonly urgent = this.notice.visible;
  /** True when the guest came back after a long pause. */
  public readonly cameBack = this.notice.cameBack;

  /** The sign-ins whose onboarding was decided. */
  private readonly settledSignIns = signal(0);
  private readonly onboardingState = signal(false);
  /**
   * True when a sign-in of this visit brought a player without a profile
   * of their own: the profile editor welcomes them, where it shows, or else
   * the main menu opens the profile to make one - as long as the player is
   * still on the screen they signed in on (see {@link moveOn}).
   */
  public readonly onboardingDue = this.onboardingState.asReadonly();
  /** True while the profile editor welcomes a player who just signed in. */
  private readonly welcomingState = signal(false);
  public readonly welcoming = this.welcomingState.asReadonly();
  /** The editor's field a step of the pass leads to, null for none. */
  private readonly focusState = signal<EditorField | null>(null);
  public readonly editorFocus = this.focusState.asReadonly();

  public constructor() {
    // The announcement is the player's who earned it: the next one, after
    // a sign-in or a sign-out, never sees it.
    this.account.players
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.earnedNow.set(false));
    effect(() => {
      if (this.next() === null && this.progress.loaded() && !this.held()) {
        untracked(() => this.earn());
      }
    });
    // Each sign-in is judged once, as soon as the signed-in player's
    // profile has answered: onboarding only for one without a profile.
    effect(() => {
      const signIns = this.signIn.signIns();
      const player = this.account.profile();
      if (
        signIns > untracked(this.settledSignIns) &&
        player !== null &&
        !player.guest &&
        this.social.profileLoaded()
      ) {
        const due = this.next() === 'profile';
        untracked(() => {
          this.settledSignIns.set(signIns);
          this.onboardingState.set(due);
        });
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

  /**
   * The player went on to another screen: a sign-in not judged yet, or an
   * onboarding no screen took, is dropped, so the profile never opens later
   * unasked. A welcome the profile already shows stays.
   */
  public moveOn(): void {
    this.settledSignIns.set(this.signIn.signIns());
    this.onboardingState.set(false);
  }

  /** The profile editor shows the sign-in's onboarding. */
  public startOnboarding(): void {
    this.onboardingState.set(false);
    this.welcomingState.set(true);
    this.focusState.set('name');
  }

  /** The profile editor has welcomed the player. */
  public endOnboarding(): void {
    this.welcomingState.set(false);
  }

  /** Asks the profile editor to focus a field, once it shows. */
  public focusEditor(field: EditorField): void {
    this.focusState.set(field);
  }

  /** The editor focused the field it was asked to. */
  public editorFocused(): void {
    this.focusState.set(null);
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
