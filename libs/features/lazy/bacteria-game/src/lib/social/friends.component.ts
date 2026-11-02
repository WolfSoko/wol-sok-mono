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
import { injectGameAnalytics } from '../analytics/game-analytics';
import { TranslationKey } from '../i18n/dictionaries';
import { I18nService } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { ModerationService } from '../moderation/moderation.service';
import { AvatarComponent } from './avatar.component';
import { FriendView, SocialService } from './social.service';

/**
 * The player's friends in the lobby - who is online, a challenge for those
 * who are - with the requests to answer and the way to invite someone.
 */
@Component({
  selector: 'feat-lazy-bac-game-friends',
  imports: [AvatarComponent, MatButtonModule, MatIconModule, TranslatePipe],
  templateUrl: './friends.component.html',
  styleUrl: './friends.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FriendsComponent {
  protected readonly social = inject(SocialService);
  /** A ban takes adding friends and challenges away (ADR 0012). */
  protected readonly moderation = inject(ModerationService);
  private readonly clipboard = inject(Clipboard);
  private readonly analytics = injectGameAnalytics();
  private readonly document = inject(DOCUMENT);
  private readonly i18n = inject(I18nService);

  /** False while the player is in a match or a lobby - no new challenge. */
  public readonly canChallenge = input(true);
  /** Challenge a friend to a match. */
  public readonly challenge = output<FriendView>();

  /** What became of the last step - a link that could not be copied as it is. */
  protected readonly note = signal<
    { key: TranslationKey } | { key: null; link: string } | null
  >(null);
  protected readonly busy = signal(false);

  /** The friend's status, and their motto after it. */
  protected statusLine(friend: FriendView): string {
    const status = this.i18n.t(this.statusKey(friend));
    return friend.card.motto === ''
      ? status
      : this.i18n.t('social.friends.statusLine', {
          status,
          motto: friend.card.motto,
        });
  }

  private statusKey(friend: FriendView): TranslationKey {
    if (!friend.mutual) {
      return 'social.friends.status.pending';
    }
    switch (friend.status) {
      case 'online':
        return 'social.friends.status.online';
      case 'playing':
        return 'social.friends.status.playing';
      default:
        return 'social.friends.status.offline';
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
          title: this.i18n.t('social.friends.share.title'),
          text: this.i18n.t('social.friends.share.text'),
          url: link,
        });
        this.trackShare('native');
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
      }
    }
    const copied = this.clipboard.copy(link);
    this.note.set(
      copied ? { key: 'social.friends.copied' } : { key: null, link }
    );
    if (copied) {
      this.trackShare('copy');
    }
  }

  private trackShare(method: 'native' | 'copy'): void {
    this.analytics.track('share', { method, content_type: 'friend_invite' });
  }

  private async run<T>(task: () => Promise<T>): Promise<T | null> {
    this.busy.set(true);
    this.note.set(null);
    try {
      return await task();
    } catch (error) {
      console.error(error);
      this.note.set({ key: 'social.failed' });
      return null;
    } finally {
      this.busy.set(false);
    }
  }
}
