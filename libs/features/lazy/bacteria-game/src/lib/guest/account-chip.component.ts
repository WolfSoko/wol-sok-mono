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
import { AvatarComponent } from '../social/avatar.component';
import { SocialService } from '../social/social.service';
import { GameAccount } from '../storage/game-account';
import { SignIn } from './sign-in.service';

/**
 * Who plays, at the top of the main menu: for a guest the way to sign in
 * with Google, for a signed-in player their picture, which opens the
 * profile: the avatar of their profile (an upload, a drawn bacterium or
 * their Google photo, as they chose), the Google photo until it is read and
 * for a player without a stored profile. Nothing without the cloud or
 * before the account is known.
 */
@Component({
  selector: 'feat-lazy-bac-game-account-chip',
  imports: [
    AvatarComponent,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    TranslatePipe,
  ],
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
            @if (avatar(); as chosen) {
              <feat-lazy-bac-game-avatar [avatar]="chosen" [size]="28" />
            } @else if (player.photoUrl; as photo) {
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
  private readonly social = inject(SocialService);

  /**
   * The avatar of the player's stored profile - null until it is read and
   * for a player who never saved one, who keeps their Google photo.
   */
  protected readonly avatar = this.social.storedAvatar;
}
