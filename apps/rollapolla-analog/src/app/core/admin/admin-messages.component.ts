import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { AdminChatMessage } from '../../../shared/admin';
import { AdminPort } from '../../ports/admin.port';
import { EndlessScroll } from '../endless-scroll/endless-scroll';
import { EndlessScrollEndComponent } from '../endless-scroll/endless-scroll-end.component';
import { AdminWrites } from './admin-writes';
import { endlessItems } from './endless-items';

/** The live chat and all poll discussions, newest first, for moderation. */
@Component({
  selector: 'rap-admin-messages',
  imports: [
    DatePipe,
    EndlessScrollEndComponent,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    RouterLink,
  ],
  template: `
    @if (failed()) {
      <p class="error" role="alert" data-testid="admin-messages-error">
        The messages could not be loaded. Trying again…
      </p>
    }
    @if (messages(); as messages) {
      @if (messages.length) {
        <ul class="list" data-testid="admin-messages">
          @for (message of messages; track message.pollId + '/' + message.id) {
            <li class="item" data-testid="admin-message">
              <div class="body">
                <span class="title">{{ message.message }}</span>
                <span class="meta">
                  {{ message.authorName ?? 'Anonymous' }}
                  @if (message.authorUid) {
                    ({{ message.authorUid }})
                  }
                  · {{ message.createdAt | date: 'medium' }} ·
                  @if (message.pollId) {
                    <a [routerLink]="['/poll', message.pollId]">poll</a>
                  } @else {
                    live chat
                  }
                </span>
              </div>
              <button
                mat-icon-button
                type="button"
                (click)="delete(message)"
                aria-label="Delete message"
                title="Delete message"
                data-testid="admin-delete-message"
              >
                <mat-icon>delete</mat-icon>
              </button>
            </li>
          }
        </ul>
        <rap-endless-scroll-end [scroll]="scroll" />
      } @else {
        <p class="empty" data-testid="admin-messages-empty">No messages.</p>
      }
    } @else if (!failed()) {
      <mat-spinner class="spinner" diameter="40" />
    }
  `,
  styleUrl: './admin-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminMessagesComponent {
  private readonly admin = inject(AdminPort);
  private readonly writes = new AdminWrites();
  protected readonly scroll = new EndlessScroll();
  private readonly page = endlessItems(
    this.scroll,
    this.admin.watchMessages(this.scroll.counts),
    'Could not load the messages'
  );
  protected readonly messages = this.page.items;
  protected readonly failed = this.page.failed;

  protected async delete(message: AdminChatMessage): Promise<void> {
    const confirmed = await this.writes.confirm({
      title: 'Delete this message?',
      text: message.message,
      action: 'Delete',
    });
    if (confirmed) {
      await this.writes.saved(
        this.admin.deleteMessage(message),
        'The message could not be deleted.'
      );
    }
  }
}
