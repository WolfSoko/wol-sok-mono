import { computed, effect, inject, Injectable, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import {
  addDoc,
  collection,
  collectionData,
  CollectionReference,
  Firestore,
  limit,
  orderBy,
  query,
} from '@angular/fire/firestore';
import { ChatMessage } from '../../shared/chat.message';
import { ChatMessagesRepoPort } from '../ports/chat-messages-repo.port';
import { NotesRepoPort } from '../ports/notes-repo.port';
import { addPendingTaskForServer } from './add-pending-task-for-server';
import { chatMessageConverter } from './chat-message.converter';
import { ChatMessageDto } from './chat-message.dto';

@Injectable()
export class ChatMessagesRepoAdapter extends ChatMessagesRepoPort {
  private readonly fs: Firestore = inject(Firestore);
  private readonly chatMessages: Signal<ChatMessage[] | undefined>;
  private readonly chatMessagesCol: CollectionReference<
    ChatMessage,
    ChatMessageDto
  >;

  constructor() {
    super();
    this.chatMessagesCol = collection(this.fs, 'chatMessages').withConverter<
      ChatMessage,
      ChatMessageDto
    >(chatMessageConverter);
    const { isServer, finishRendering } = addPendingTaskForServer();

    // load old Notes
    const notes = inject(NotesRepoPort).getNotes();
    const chatMessages$ = collectionData(
      query(this.chatMessagesCol, orderBy('createdAt', 'desc'), limit(20))
    );

    const chatMessages = toSignal(chatMessages$, {
      initialValue: [],
      rejectErrors: true,
    });

    this.chatMessages = computed(() => {
      const concatMessages: ChatMessage[] = [
        ...(chatMessages() ?? []),
        ...(notes() ?? []),
      ];
      return concatMessages.length > 0 ? concatMessages : undefined;
    });

    if (isServer) {
      effect(() => {
        const messages = this.chatMessages();
        if ((messages?.length ?? 0) === 0) {
          // give the server 200ms to load the notes
          // otherwise finish rendering
          setTimeout(finishRendering, 200);
          return;
        }
        // if notes are loaded, finish rendering
        finishRendering();
      });
    }
  }

  getChatMessages(): Signal<ChatMessage[] | undefined> {
    return this.chatMessages;
  }

  async addChatMessage(message: string): Promise<void> {
    if (!this.validateMessage(message)) {
      return;
    }
    const chatMessage: ChatMessage = {
      id: '-1',
      message,
      createdAt: new Date(),
    };
    await addDoc(this.chatMessagesCol, chatMessage);
  }
}
