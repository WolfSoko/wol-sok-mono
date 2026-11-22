import { computed, inject, Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, firstValueFrom } from 'rxjs';
import { injectGameAnalytics } from '../analytics/game-analytics';
import { ProgressService } from '../progress.service';
import { GameAccount } from '../storage/game-account';

/**
 * Signing in with Google and out again, for every button that offers it:
 * the profile's, the main menu's and the guest's notices - and with the
 * token of the Android app's Play Games sign-in (#3175). One at a time,
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
  /** Counts the sign-ins that succeeded in this visit - the Lab Pass's cue. */
  private readonly signInCount = signal(0);
  public readonly signIns = this.signInCount.asReadonly();
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
        this.signInCount.update((count) => count + 1);
        this.analytics.track('login', { method: 'google' });
      } else {
        this.analytics.track('login_failed', { reason: outcome });
      }
    });
  }

  private readonly ready$ = toObservable(this.ready);

  /**
   * Signs in with the custom token of a Play Games sign-in, once a sign-in
   * can start. Silent, as Play Games' own sign-in is: a refused token
   * leaves the player as they are and shows no failure. Counts for the Lab
   * Pass only when a guest became a signed-in player - every later start of
   * the app just renews the session.
   */
  public async signInWithToken(token: string, writer: string): Promise<void> {
    await firstValueFrom(this.ready$.pipe(filter(Boolean)));
    const wasGuest = this.account.profile()?.guest === true;
    await this.whileBusy(async () => {
      if ((await this.account.signInWithToken(token, writer)) && wasGuest) {
        this.signInCount.update((count) => count + 1);
        this.analytics.track('login', { method: 'play_games' });
      }
    });
    this.failed.set(false);
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
