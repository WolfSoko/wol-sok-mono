import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ChatMessage } from '../../../shared/chat.message';

@Component({
  selector: 'rap-messages-list',
  template: `@if (messages(); as messages) {
      <ul class="messages-list" data-testid="messages-list">
        @for (message of messages; track message.id) {
          <li class="message">
            <span class="avatar" aria-hidden="true">
              <mat-icon>chat_bubble_outline</mat-icon>
            </span>
            <div class="bubble">
              <p
                class="text"
                [attr.data-testid]="'message-item-' + message.id"
                [textContent]="message.message"
              ></p>
              <time
                class="time"
                [attr.datetime]="message.createdAt.toISOString()"
                >{{ message.createdAt | date: 'medium' }}</time
              >
            </div>
          </li>
        } @empty {
          <li class="empty">
            <mat-icon class="empty-icon" aria-hidden="true">forum</mat-icon>
            <h3>No messages yet!</h3>
            <p>Add a new one and see them appear here...</p>
          </li>
        }
      </ul>
    } @else {
      <mat-spinner
        class="loading"
        diameter="32"
        aria-label="Loading messages"
      />
    }`,
  styles: `
    :host {
      display: block;
      max-height: 480px;
      overflow-y: auto;
      scrollbar-gutter: stable;
    }
    .messages-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .message {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
    }
    .avatar {
      display: grid;
      place-items: center;
      flex: none;
      width: 2.25rem;
      height: 2.25rem;
      border-radius: 50%;
      color: var(--mat-sys-on-tertiary-container);
      background: var(--mat-sys-tertiary-container);

      mat-icon {
        font-size: 1.125rem;
        width: 1.125rem;
        height: 1.125rem;
      }
    }
    .bubble {
      min-width: 0;
      padding: 0.625rem 0.875rem;
      border-radius: 4px var(--rap-radius-md) var(--rap-radius-md);
      background: var(--mat-sys-surface-container-high);
    }
    .text {
      margin: 0;
      overflow-wrap: anywhere;
      white-space: pre-line;
    }
    .time {
      display: block;
      margin-top: 0.25rem;
      font: var(--mat-sys-label-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .empty {
      padding: 2rem 1rem;
      text-align: center;
      color: var(--mat-sys-on-surface-variant);

      h3 {
        margin: 0.5rem 0 0.25rem;
        font: var(--mat-sys-title-medium);
        color: var(--mat-sys-on-surface);
      }
      p {
        margin: 0;
      }
    }
    .empty-icon {
      width: 2.5rem;
      height: 2.5rem;
      font-size: 2.5rem;
    }
    .loading {
      margin: 2rem auto;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, MatIconModule, MatProgressSpinnerModule],
})
export class MessagesListComponent {
  public readonly messages = input<ChatMessage[]>();
}
