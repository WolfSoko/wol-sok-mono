import { Signal } from '@angular/core';
import { ChatMessage } from '../../shared/chat.message';

export abstract class ChatMessagesRepoPort {
  static readonly MAX_MESSAGE_LENGTH: number = 1000;
  static readonly MIN_MESSAGE_LENGTH: number = 10;

  protected validateMessage(message: string): boolean {
    return (
      message.length >= ChatMessagesRepoPort.MIN_MESSAGE_LENGTH &&
      message.length <= ChatMessagesRepoPort.MAX_MESSAGE_LENGTH
    );
  }

  abstract getChatMessages(): Signal<ChatMessage[] | undefined>;
  /**
   * Signs the visitor in if needed and posts the message. Resolves once it is
   * applied locally; rejects if signing in fails.
   */
  abstract addChatMessage(newMessage: string): Promise<void>;
}
