import { DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { ChatMessage } from '../../../shared/chat.message';

@Component({
  selector: 'rap-messages-list',
  template: `@if (messages()) {
      <mat-list class="messages-list" data-testid="messages-list">
        @for (message of messages(); track message.id; let i = $index) {
          <li>
            <mat-card>
              <mat-card-subtitle>
                <span [attr.data-testid]="'message-item-' + message.id">{{
                  message.message
                }}</span>
              </mat-card-subtitle>
              <mat-card-footer>
                <span class="mat-label-small">{{
                  message.createdAt | date: 'medium'
                }}</span>
              </mat-card-footer>
            </mat-card>
            <br />
          </li>
        }
        @if (messages()?.length === 0) {
          <div>
            <h4>No messages yet!</h4>
            <p>Add a new one and see them appear here...</p>
          </div>
        }
      </mat-list>
    } @else {
      <ng-template #loading>
        <p class="loading-text">Loading...</p>
      </ng-template>
    }`,
  styles: `
    :host {
      display: block;
      max-height: 480px;
      overflow-y: auto;
    }

    .messages-list {
    }
  `,

  imports: [DatePipe, MatListModule, MatCardModule],
})
export class MessagesListComponent {
  messages = input<ChatMessage[]>();
}
