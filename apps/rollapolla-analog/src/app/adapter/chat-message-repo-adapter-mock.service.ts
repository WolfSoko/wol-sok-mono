import { Injectable, signal, Signal, WritableSignal } from '@angular/core';
import { ChatMessage } from '../../shared/chat.message';
import {
  ChatMessagesRepoPort,
  PostReceipt,
} from '../ports/chat-messages-repo.port';

@Injectable()
export class ChatMessageRepoAdapterMock extends ChatMessagesRepoPort {
  private readonly chatMessages: WritableSignal<ChatMessage[]> = signal([]);

  getChatMessages(): Signal<ChatMessage[] | undefined> {
    return this.chatMessages;
  }

  async addChatMessage(message: string): Promise<PostReceipt> {
    this.chatMessages.update((messages) => [
      ...messages,
      {
        id: String(messages.length + 1),
        message,
        createdAt: new Date(),
      } as ChatMessage,
    ]);
    return { saved: Promise.resolve() };
  }
}
