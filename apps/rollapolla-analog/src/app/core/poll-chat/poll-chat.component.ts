import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatCardModule } from '@angular/material/card';
import { catchError, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { isOpen, Poll } from '../../../shared/poll';
import { ChatMessagesRepoPort } from '../../ports/chat-messages-repo.port';
import { injectRollaPollaAnalytics } from '../analytics/rollapolla-analytics';
import { ChatMessageFormComponent } from '../chat-live-stream/chat-message-form.component';
import { PostTracker } from '../chat-live-stream/post-tracker';
import { MessagesListComponent } from '../chat-live-stream/messages-list.component';

/** The poll's own discussion, below the poll. */
@Component({
  selector: 'rap-poll-chat',
  imports: [ChatMessageFormComponent, MatCardModule, MessagesListComponent],
  template: `
    <mat-card appearance="outlined" class="card" data-testid="poll-chat">
      <mat-card-header>
        <mat-card-title>
          <h2 class="title">Discussion</h2>
        </mat-card-title>
        <mat-card-subtitle>What do you think, and why?</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content class="content">
        @if (isOpen(poll())) {
          <rap-chat-message-form
            [minMessageLength]="minLength"
            [maxMessageLength]="maxLength"
            (messageAdded)="post($event)"
          />
          @if (postFailed()) {
            <p class="error" role="alert" data-testid="poll-chat-error">
              Your message could not be posted. Please try again.
            </p>
          }
        } @else {
          <p class="closed">This poll is closed, so is its discussion.</p>
        }
        @if (messages() === null) {
          <p class="error" role="alert" data-testid="poll-chat-load-error">
            The discussion could not be loaded. Please reload the page.
          </p>
        } @else {
          <rap-messages-list [messages]="messages() ?? undefined" />
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    :host {
      display: block;
    }
    .card {
      padding: 0.75rem 0.5rem 0.5rem;
    }
    .title {
      margin: 0;
      font: inherit;
    }
    .content {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding-top: 1rem;
    }
    .error {
      margin: 0;
      color: var(--mat-sys-error);
    }
    .closed {
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PollChatComponent {
  public readonly poll = input.required<Poll>();

  private readonly chatRepo = inject(ChatMessagesRepoPort);
  private readonly analytics = injectRollaPollaAnalytics();

  protected readonly minLength: number =
    ChatMessagesRepoPort.MIN_MESSAGE_LENGTH;
  protected readonly maxLength: number =
    ChatMessagesRepoPort.MAX_MESSAGE_LENGTH;
  protected readonly isOpen = isOpen;
  private readonly posts = new PostTracker();
  protected readonly postFailed = this.posts.failed;

  /** `undefined` while the thread loads, `null` if it could not be loaded. */
  protected readonly messages = toSignal(
    toObservable(this.poll).pipe(
      map((poll) => poll.id),
      distinctUntilChanged(),
      switchMap((pollId) =>
        this.chatRepo.watchPollChat(pollId).pipe(
          // toSignal would rethrow it on every read and break the page
          catchError((error: unknown) => {
            console.error('Could not load the discussion', error);
            return of(null);
          })
        )
      )
    )
  );

  protected async post(message: string): Promise<void> {
    const sent = await this.posts.post(() =>
      this.chatRepo.addPollChatMessage(this.poll(), message.trim())
    );
    if (sent) {
      this.analytics.track('chat_message_sent', { chat: 'poll' });
    }
  }
}
