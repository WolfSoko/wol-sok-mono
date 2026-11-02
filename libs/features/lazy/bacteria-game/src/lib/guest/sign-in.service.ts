import { computed, inject, Injectable, signal } from '@angular/core';
import { injectGameAnalytics } from '../analytics/game-analytics';
import { ProgressService } from '../progress.service';
import { GameAccount } from '../storage/game-account';

/**
 * Signing in with Google and out again, for every button that offers it:
 * the profile's, the main menu's and the guest's notices. One at a time,
 * and a sign-in only once the guest's progress is here: an account that
 * played elsewhere adopts what the guest has, and the guest's stored
 * progress is out of reach once the account has taken over.
 */
@Injectable({ providedIn: 'root' })
export class SignIn {
  private readonly account = inject(GameAccount);
  private readonly progress = inject(ProgressService);
  private readonly analytics = injectGameAnalytics();

  public readonly busy = signal(false);
  /** True when the last sign-in or sign-out failed. */
  public readonly failed = signal(false);
  /** True while a sign-in can start. */
  public readonly ready = computed(
    () => !this.busy() && this.progress.loaded()
  );

  public async signIn(): Promise<void> {
    if (!this.ready()) return;
    await this.whileBusy(async () => {
      const outcome = await this.account.signIn();
      this.failed.set(outcome === 'failed');
      if (outcome === 'signed-in') {
        this.analytics.track('login', { method: 'google' });
      } else {
        this.analytics.track('login_failed', { reason: outcome });
      }
    });
  }

  public async signOut(): Promise<void> {
    if (this.busy()) return;
    await this.whileBusy(async () => {
      await this.account.signOut();
      this.analytics.track('logout');
    });
  }

  private async whileBusy(task: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.failed.set(false);
    try {
      await task();
    } catch (error) {
      console.error(error);
      this.failed.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
