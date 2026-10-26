import {
  ChangeDetectionStrategy,
  Component,
  inject,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '../i18n/translate.pipe';
import { GameAccount } from '../storage/game-account';
import { SignIn } from './sign-in.service';

/**
 * Who plays, at the top of the main menu: for a guest the way to sign in
 * with Google, for a signed-in player their picture, which opens the
 * profile. Nothing without the cloud or before the account is known.
 */
@Component({
  selector: 'feat-lazy-bac-game-account-chip',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule, TranslatePipe],
  template: `
    @if (account.cloud) {
      @if (account.profile(); as player) {
        @if (player.guest) {
          <button
            mat-stroked-button
            type="button"
            class="sign-in"
            [disabled]="!signIn.ready()"
            [attr.aria-label]="'profile.guest.chipHint' | t"
            [matTooltip]="'profile.guest.chipHint' | t"
            (click)="signIn.signIn()"
          >
            <mat-icon>login</mat-icon>
            <span class="label">{{ 'profile.guest.chip' | t }}</span>
          </button>
        } @else {
          @let label =
            'profile.guest.profile'
              | t: { name: player.name ?? ('profile.account.googleUser' | t) };
          <button
            mat-icon-button
            type="button"
            [attr.aria-label]="label"
            [matTooltip]="label"
            (click)="profile.emit()"
          >
            @if (player.photoUrl; as photo) {
              <img
                class="photo"
                [src]="photo"
                alt=""
                referrerpolicy="no-referrer"
              />
            } @else {
              <mat-icon>account_circle</mat-icon>
            }
          </button>
        }
      }
    }
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
    }

    .sign-in {
      --mat-button-outlined-label-text-color: var(--bw-text);
    }

    /* On a phone the icon alone, beside the title. */
    @media (max-width: 40rem) {
      .sign-in {
        min-width: 0;
        padding: 0 0.75rem;
      }

      .sign-in .mat-icon {
        margin: 0;
      }

      .label {
        display: none;
      }
    }

    .photo {
      width: 1.75rem;
      height: 1.75rem;
      border-radius: 50%;
      object-fit: cover;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountChipComponent {
  /** To the profile, from a signed-in player's picture. */
  public readonly profile = output<void>();

  protected readonly account = inject(GameAccount);
  protected readonly signIn = inject(SignIn);
}
