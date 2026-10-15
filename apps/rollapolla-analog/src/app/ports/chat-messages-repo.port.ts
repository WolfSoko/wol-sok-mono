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
   * Posts a message as the signed-in visitor. Rejects with `SignInRequired`
   * when nobody is signed in with Google: the rules refuse anonymous authors.
   */
  abstract addChatMessage(newMessage: string): Promise<void>;
}

export class SignInRequired extends Error {
  constructor() {
    super('Sign in with Google to chat');
    this.name = 'SignInRequired';
  }
}
