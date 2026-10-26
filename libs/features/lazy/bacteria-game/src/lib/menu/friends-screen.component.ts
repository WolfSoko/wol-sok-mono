import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
} from '@angular/core';
import { TranslatePipe } from '../i18n/translate.pipe';
import { FriendsComponent } from '../social/friends.component';
import { FriendView, SocialService } from '../social/social.service';
import { ScreenHeaderComponent } from './screen-header.component';
import { GuestSignInComponent } from '../guest/guest-sign-in.component';

/**
 * The player's friends as a screen of its own: who is online, the requests
 * to answer, the way to invite someone - and a challenge, which the game
 * takes on to the online lobby.
 */
@Component({
  selector: 'feat-lazy-bac-game-friends-screen',
  imports: [
    FriendsComponent,
    GuestSignInComponent,
    ScreenHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './friends-screen.component.html',
  styleUrl: './friends-screen.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FriendsScreenComponent {
  protected readonly social = inject(SocialService);

  /** False while an online match or a lobby is under way - no challenge. */
  public readonly canChallenge = input(true);

  public readonly challenge = output<FriendView>();
  public readonly back = output<void>();
}
