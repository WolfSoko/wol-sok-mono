import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  Signal,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ChatMessage } from '../../../shared/chat.message';
import { ChatMessagesRepoPort } from '../../ports/chat-messages-repo.port';
import { ChatMessageFormComponent } from './chat-message-form.component';
import { MessagesListComponent } from './messages-list.component';

@Component({
  selector: 'rap-chat-live-stream',

  imports: [
    MatCardModule,
    MessagesListComponent,
    ChatMessageFormComponent,
    MatProgressSpinnerModule,
  ],
  templateUrl: './chat-live-stream.component.html',
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      gap: 0.2rem;
      justify-content: stretch;
      align-items: start;
    }
    .form,
    .notes {
      flex: 1 1 auto;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatLiveStreamComponent {
  readonly minLength: Signal<number> = signal(
    ChatMessagesRepoPort.MIN_MESSAGE_LENGTH
  ).asReadonly();
  readonly maxLength: Signal<number> = signal(
    ChatMessagesRepoPort.MAX_MESSAGE_LENGTH
  ).asReadonly();

  private readonly chatMessagesRepo = inject(ChatMessagesRepoPort);

  chatMessages: Signal<ChatMessage[] | undefined> =
    this.chatMessagesRepo.getChatMessages();

  addChatMessage(message: string) {
    this.chatMessagesRepo.addChatMessage(message.trim());
  }
}
