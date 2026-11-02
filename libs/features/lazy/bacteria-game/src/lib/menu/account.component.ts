import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../i18n/translate.pipe';
import { GUEST_IDLE_DAYS } from '../guest/guest-visits';
import { SignIn } from '../guest/sign-in.service';
import { GameAccount } from '../storage/game-account';

/**
 * Where the progress is kept, and the way to sign in to keep it on every
 * device - or out again. Without the cloud it is kept on this device.
 */
@Component({
  selector: 'feat-lazy-bac-game-account',
  imports: [MatButtonModule, MatIconModule, TranslatePipe],
  template: `
    @if (!account.cloud) {
      <span class="note">{{ 'profile.account.local' | t }}</span>
    } @else {
      @let player = account.profile();
      @if (player === null) {
        <span class="note">{{ 'profile.account.connecting' | t }}</span>
      } @else if (player.guest) {
        <span class="note">{{ 'profile.account.guest' | t }}</span>
        <button
          mat-stroked-button
          type="button"
          [disabled]="!signIn.ready()"
          (click)="signIn.signIn()"
          [title]="'profile.account.signInHint' | t"
        >
          <mat-icon>login</mat-icon>
          {{ 'profile.account.signIn' | t }}
        </button>
        <span class="deletion">
          {{ 'profile.account.deletion' | t: { days: idleDays } }}
        </span>
      } @else {
        <span class="note">
          {{ 'profile.account.signedInAs' | t }}
          <strong>{{
            player.name ?? ('profile.account.googleUser' | t)
          }}</strong>
        </span>
        <button
          mat-stroked-button
          type="button"
          [disabled]="signIn.busy()"
          (click)="signIn.signOut()"
        >
          <mat-icon>logout</mat-icon>
          {{ 'profile.account.signOut' | t }}
        </button>
      }
      @if (signIn.failed()) {
        <span class="failed" role="status">{{ 'social.failed' | t }}</span>
      }
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-end;
      gap: 0.5rem 0.75rem;
      margin-left: auto;
    }

    .note {
      font-size: 0.9rem;
      color: var(--bw-muted);

      strong {
        color: var(--bw-text);
      }
    }

    .deletion,
    .failed {
      flex-basis: 100%;
      text-align: right;
      font-size: 0.85rem;
    }

    .deletion {
      color: var(--bw-muted);
    }

    .failed {
      color: var(--bw-gold);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountComponent {
  protected readonly account = inject(GameAccount);
  protected readonly signIn = inject(SignIn);
  protected readonly idleDays = GUEST_IDLE_DAYS;
}
