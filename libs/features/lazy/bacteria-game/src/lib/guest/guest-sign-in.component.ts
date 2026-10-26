import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslationKey } from '../i18n/dictionaries';
import { TranslatePipe } from '../i18n/translate.pipe';
import { GuestNotice } from './guest-notice.service';
import { SignIn } from './sign-in.service';

/**
 * A line for guests where what they see belongs to their guest account -
 * the friends, the leaderboards, the saved matches, a success - with the
 * way to sign in with Google and keep it. Shows nothing to anyone else.
 */
@Component({
  selector: 'feat-lazy-bac-game-guest-sign-in',
  imports: [MatButtonModule, MatIconModule, TranslatePipe],
  host: { '[hidden]': '!notice.guest()' },
  template: `
    @if (notice.guest()) {
      <p class="note">{{ note() | t }}</p>
      <button
        mat-stroked-button
        type="button"
        [disabled]="!signIn.ready()"
        (click)="signIn.signIn()"
      >
        <mat-icon>login</mat-icon>
        {{ 'profile.account.signIn' | t }}
      </button>
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
      gap: 0.5rem 1rem;
    }

    :host([hidden]) {
      display: none;
    }

    .note {
      flex: 1 1 16rem;
      margin: 0;
      line-height: 1.4;
      color: var(--bw-soft);
    }

    .failed {
      flex-basis: 100%;
      font-size: 0.85rem;
      color: var(--bw-gold);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuestSignInComponent {
  /** Why it pays to sign in here. */
  public readonly note = input.required<TranslationKey>();

  protected readonly notice = inject(GuestNotice);
  protected readonly signIn = inject(SignIn);
}
