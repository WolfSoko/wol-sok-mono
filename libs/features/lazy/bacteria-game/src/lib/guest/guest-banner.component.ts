import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../i18n/translate.pipe';
import { GuestNotice } from './guest-notice.service';
import { GUEST_IDLE_DAYS } from './guest-visits';
import { SignIn } from './sign-in.service';

/**
 * The main menu's notice to a guest: an unused guest account is deleted
 * after {@link GUEST_IDLE_DAYS} days, with the way to sign in with Google
 * and "Later". Shown by the menu while `GuestNotice.visible` says so.
 */
@Component({
  selector: 'feat-lazy-bac-game-guest-banner',
  imports: [MatButtonModule, MatIconModule, TranslatePipe],
  template: `
    @let title =
      (notice.cameBack() ? 'profile.guest.welcomeBack' : 'profile.guest.title')
        | t;
    <aside class="banner" [attr.aria-label]="title">
      <mat-icon class="badge" aria-hidden="true">account_circle</mat-icon>
      <div class="text">
        <strong class="title">{{ title }}</strong>
        <p class="note">
          {{ 'profile.guest.note' | t: { days: idleDays } }}
        </p>
      </div>
      <div class="actions">
        <button
          mat-flat-button
          type="button"
          class="sign-in"
          [disabled]="!signIn.ready()"
          (click)="signIn.signIn()"
        >
          <mat-icon>login</mat-icon>
          {{ 'profile.account.signIn' | t }}
        </button>
        <button mat-button type="button" (click)="notice.dismiss()">
          {{ 'profile.guest.later' | t }}
        </button>
      </div>
      @if (signIn.failed()) {
        <span class="failed" role="status">{{ 'social.failed' | t }}</span>
      }
    </aside>
  `,
  styles: `
    :host {
      display: block;
    }

    .banner {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.5rem 1rem;
      align-items: center;
      box-sizing: border-box;
      padding: 1rem 1.25rem;
      border: 2px solid var(--bw-player);
      border-radius: 1.25rem;
      background: var(--bw-surface-glass);
      color: var(--bw-text);
    }

    .badge {
      width: 2.5rem;
      height: 2.5rem;
      font-size: 2.5rem;
      color: var(--bw-player);
    }

    .text {
      min-width: 0;
    }

    .title {
      display: block;
      font-family: var(--bw-display);
      font-weight: 800;
      font-size: 1.35rem;
      line-height: 1.15;
    }

    .note {
      margin: 0.25rem 0 0;
      line-height: 1.4;
      color: var(--bw-soft);
    }

    .actions,
    .failed {
      grid-column: 1 / -1;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .sign-in {
      --mat-button-filled-container-color: var(--bw-player);
      --mat-button-filled-label-text-color: var(--bw-on-player);
    }

    .failed {
      font-size: 0.85rem;
      color: var(--bw-gold);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuestBannerComponent {
  protected readonly notice = inject(GuestNotice);
  protected readonly signIn = inject(SignIn);
  protected readonly idleDays = GUEST_IDLE_DAYS;
}
