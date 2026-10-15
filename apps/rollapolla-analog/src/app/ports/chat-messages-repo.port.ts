import { Signal } from '@angular/core';
import { Observable } from 'rxjs';
import { ChatMessage } from '../../shared/chat.message';
import { Poll } from '../../shared/poll';

export type PostReceipt = { saved: Promise<unknown> };

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
   * applied locally; rejects if signing in fails. `saved` settles once the
   * backend accepted the message or rejected it.
   */
  abstract addChatMessage(newMessage: string): Promise<PostReceipt>;

  /** Emits the poll's own chat thread, newest first. */
  abstract watchPollChat(pollId: string): Observable<ChatMessage[]>;

  /**
   * Like {@link addChatMessage}, into the poll's thread. The message expires
   * with the poll; an `unsaved` featured poll is stored first.
   */
  abstract addPollChatMessage(
    poll: Poll,
    newMessage: string
  ): Promise<PostReceipt>;
}
