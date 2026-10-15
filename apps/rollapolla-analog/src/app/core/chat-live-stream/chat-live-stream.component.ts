import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  Signal,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { ChatMessage } from '../../../shared/chat.message';
import { ChatMessagesRepoPort } from '../../ports/chat-messages-repo.port';
import { ChatMessageFormComponent } from './chat-message-form.component';
import { MessagesListComponent } from './messages-list.component';

@Component({
  selector: 'rap-chat-live-stream',
  imports: [MatCardModule, MessagesListComponent, ChatMessageFormComponent],
  templateUrl: './chat-live-stream.component.html',
  styles: `
    :host {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 1.5rem;
      align-items: start;

      @media (min-width: 900px) {
        grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
      }
    }
    mat-card {
      padding: 0.75rem 0.5rem 0.5rem;
    }
    .content {
      padding-top: 1rem;
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
