import { Injectable, signal, Signal, WritableSignal } from '@angular/core';
import { BehaviorSubject, map, Observable } from 'rxjs';
import { ChatMessage } from '../../shared/chat.message';
import { Poll } from '../../shared/poll';
import {
  ChatMessagesRepoPort,
  PostReceipt,
} from '../ports/chat-messages-repo.port';

@Injectable()
export class ChatMessageRepoAdapterMock extends ChatMessagesRepoPort {
  private readonly chatMessages: WritableSignal<ChatMessage[]> = signal([]);
  /** Poll threads by poll id, newest message first. */
  public readonly pollChats$ = new BehaviorSubject<
    Record<string, ChatMessage[]>
  >({});

  public getChatMessages(): Signal<ChatMessage[] | undefined> {
    return this.chatMessages;
  }

  public async addChatMessage(message: string): Promise<PostReceipt> {
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

  public watchPollChat(pollId: string): Observable<ChatMessage[]> {
    return this.pollChats$.pipe(map((chats) => chats[pollId] ?? []));
  }

  public async addPollChatMessage(
    { id }: Poll,
    message: string
  ): Promise<PostReceipt> {
    const thread = this.pollChats$.value[id] ?? [];
    this.pollChats$.next({
      ...this.pollChats$.value,
      [id]: [
        {
          id: `${id}-${thread.length + 1}`,
          message,
          createdAt: new Date(),
          authorUid: 'mock-user',
          authorName: null,
        },
        ...thread,
      ],
    });
    return { saved: Promise.resolve() };
  }
}
