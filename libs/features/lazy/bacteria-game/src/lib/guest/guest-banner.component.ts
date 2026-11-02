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
          class="sign-in primary"
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
  styleUrl: './guest-banner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuestBannerComponent {
  protected readonly notice = inject(GuestNotice);
  protected readonly signIn = inject(SignIn);
  protected readonly idleDays = GUEST_IDLE_DAYS;
}
