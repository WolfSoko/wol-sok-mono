import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatCardModule } from '@angular/material/card';
import { distinctUntilChanged, map, switchMap } from 'rxjs';
import { isOpen, Poll } from '../../../shared/poll';
import { ChatMessagesRepoPort } from '../../ports/chat-messages-repo.port';
import { ChatMessageFormComponent } from '../chat-live-stream/chat-message-form.component';
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
        <rap-messages-list [messages]="messages()" />
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

  protected readonly minLength: number =
    ChatMessagesRepoPort.MIN_MESSAGE_LENGTH;
  protected readonly maxLength: number =
    ChatMessagesRepoPort.MAX_MESSAGE_LENGTH;
  protected readonly isOpen = isOpen;
  protected readonly postFailed = signal(false);

  /** `undefined` while the thread loads. */
  protected readonly messages = toSignal(
    toObservable(this.poll).pipe(
      map((poll) => poll.id),
      distinctUntilChanged(),
      switchMap((pollId) => this.chatRepo.watchPollChat(pollId))
    )
  );

  protected async post(message: string): Promise<void> {
    this.postFailed.set(false);
    try {
      const { saved } = await this.chatRepo.addPollChatMessage(
        this.poll(),
        message.trim()
      );
      saved.catch((error: unknown) => {
        console.error('Poll chat message was rejected', error);
        this.postFailed.set(true);
      });
    } catch (error) {
      console.error('Could not post poll chat message', error);
      this.postFailed.set(true);
    }
  }
}
