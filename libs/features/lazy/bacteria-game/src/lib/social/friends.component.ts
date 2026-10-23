import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Clipboard } from '@angular/cdk/clipboard';
import { DOCUMENT } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AvatarComponent } from './avatar.component';
import { FriendView, SocialService } from './social.service';

/**
 * The player's friends in the lobby - who is online, a challenge for those
 * who are - with the requests to answer and the way to invite someone.
 */
@Component({
  selector: 'feat-lazy-bac-game-friends',
  imports: [AvatarComponent, MatButtonModule, MatIconModule],
  templateUrl: './friends.component.html',
  styleUrl: './friends.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FriendsComponent {
  protected readonly social = inject(SocialService);
  private readonly clipboard = inject(Clipboard);
  private readonly document = inject(DOCUMENT);

  /** False while the player is in a match or a lobby - no new challenge. */
  public readonly canChallenge = input(true);
  /** Challenge a friend to a match. */
  public readonly challenge = output<FriendView>();

  protected readonly note = signal<string | null>(null);
  protected readonly busy = signal(false);

  /** The friend's status, and their motto after it. */
  protected statusLine(friend: FriendView): string {
    const status = this.statusLabel(friend);
    return friend.card.motto === ''
      ? status
      : `${status} · ${friend.card.motto}`;
  }

  private statusLabel(friend: FriendView): string {
    if (!friend.mutual) {
      return 'Not accepted yet';
    }
    switch (friend.status) {
      case 'online':
        return 'Online';
      case 'playing':
        return 'Playing';
      default:
        return 'Offline';
    }
  }

  protected async accept(uid: string): Promise<void> {
    await this.run(() => this.social.acceptRequest(uid));
  }

  protected async decline(uid: string): Promise<void> {
    await this.run(() => this.social.declineRequest(uid));
  }

  protected async remove(friend: FriendView): Promise<void> {
    await this.run(() => this.social.removeFriend(friend.uid));
  }

  /**
   * Makes an invitation link and hands it on: through the share sheet where
   * there is one, else copied.
   */
  protected async invite(): Promise<void> {
    const view = this.document.defaultView;
    const link = await this.run(() =>
      this.social.inviteLink(this.document.location.href)
    );
    if (link == null || view == null) {
      return;
    }
    if (typeof view.navigator.share === 'function') {
      try {
        await view.navigator.share({
          title: 'Bacteria Wars',
          text: 'Be my friend in Bacteria Wars - and fight me!',
          url: link,
        });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
      }
    }
    this.note.set(
      this.clipboard.copy(link)
        ? 'Link copied - send it to a friend. It works for a week.'
        : link
    );
  }

  private async run<T>(task: () => Promise<T>): Promise<T | null> {
    this.busy.set(true);
    this.note.set(null);
    try {
      return await task();
    } catch (error) {
      console.error(error);
      this.note.set('That did not work - try again.');
      return null;
    } finally {
      this.busy.set(false);
    }
  }
}
