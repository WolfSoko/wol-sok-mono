import {
  computed,
  effect,
  EnvironmentInjector,
  inject,
  Injectable,
  runInInjectionContext,
  Signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Auth, User } from '@angular/fire/auth';

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
import { Observable } from 'rxjs';
import { isGoogleAccount } from '../../shared/account';
import { ChatMessage } from '../../shared/chat.message';
import { Poll } from '../../shared/poll';
import {
  ChatMessagesRepoPort,
  PostReceipt,
} from '../ports/chat-messages-repo.port';
import { NotesRepoPort } from '../ports/notes-repo.port';
import { addPendingTaskForServer } from './add-pending-task-for-server';
import { chatMessageConverter } from './chat-message.converter';
import { adoptGoogleProfile, ensureSignedIn } from './ensure-signed-in';
import { ChatMessageDto } from './chat-message.dto';
import { saveFeaturedPoll } from './featured-poll-doc';
import { queryData } from './snapshots';

const CHAT_PAGE_SIZE = 20;

@Injectable()
export class ChatMessagesRepoAdapter extends ChatMessagesRepoPort {
  private readonly fs: Firestore = inject(Firestore);
  private readonly auth: Auth = inject(Auth);
  private readonly injector = inject(EnvironmentInjector);
  private readonly chatMessagesCol: CollectionReference<
    ChatMessage,
    ChatMessageDto
  > = this.messagesCol('chatMessages');
  /** The lobby chat, loaded on first use: poll pages don't show it. */
  private lobby: Signal<ChatMessage[] | undefined> | undefined;

  public getChatMessages(): Signal<ChatMessage[] | undefined> {
    this.lobby ??= runInInjectionContext(this.injector, () =>
      this.watchLobby()
    );
    return this.lobby;
  }

  private watchLobby(): Signal<ChatMessage[] | undefined> {
    const { isServer, finishRendering } = addPendingTaskForServer();

    // load old Notes
    const notes = inject(NotesRepoPort).getNotes();
    const chatMessages$ = collectionData(
      query(
        this.chatMessagesCol,
        orderBy('createdAt', 'desc'),
        limit(CHAT_PAGE_SIZE)
      )
    );

    const chatMessages = toSignal(chatMessages$, {
      initialValue: [],
    });

    const lobby = computed(() => {
      const concatMessages: ChatMessage[] = [
        ...(chatMessages() ?? []),
        ...(notes() ?? []),
      ];
      return concatMessages.length > 0 ? concatMessages : undefined;
    });

    if (isServer) {
      effect(() => {
        const messages = lobby();
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
    return lobby;
  }

  public watchPollChat(pollId: string): Observable<ChatMessage[]> {
    return queryData(
      query(
        this.messagesCol('polls', pollId, 'chatMessages'),
        orderBy('createdAt', 'desc'),
        limit(CHAT_PAGE_SIZE)
      )
    );
  }

  public async addChatMessage(message: string): Promise<PostReceipt> {
    return this.post(this.chatMessagesCol, message, () => this.googleUser());
  }

  public async addPollChatMessage(
    poll: Poll,
    message: string
  ): Promise<PostReceipt> {
    return this.post(
      this.messagesCol('polls', poll.id, 'chatMessages'),
      message,
      () => ensureSignedIn(this.auth),
      () => (poll.unsaved ? saveFeaturedPoll(this.fs, poll) : poll).closesAt
    );
  }

  /** The live chat is for Google accounts only; the rules refuse the rest. */
  private async googleUser(): Promise<User> {
    await this.auth.authStateReady();
    const user = this.auth.currentUser;
    if (!isGoogleAccount(user)) {
      throw new Error('Sign in with Google to chat');
    }
    return user;
  }

  /**
   * `signIn` and `expiresAt` run only once the message is valid, `expiresAt`
   * only once the visitor signed in.
   */
  private async post(
    col: CollectionReference<ChatMessage, ChatMessageDto>,
    message: string,
    signIn: () => Promise<User>,
    expiresAt?: () => Date
  ): Promise<PostReceipt> {
    if (!this.validateMessage(message)) {
      return { saved: Promise.resolve() };
    }
    // accounts linked to Google before the name was copied get it now
    const author = await adoptGoogleProfile(await signIn());
    // The rules compare the name with the token's, which can lag behind the
    // profile (a failed refresh in adoptGoogleProfile), so it comes from there.
    const { claims } = await author.getIdTokenResult();
    const tokenName =
      typeof claims['name'] === 'string' ? claims['name'] : null;
    const chatMessage: ChatMessage = {
      id: '-1',
      message,
      createdAt: new Date(),
      authorUid: author.uid,
      authorName: author.isAnonymous ? null : tokenName,
      expiresAt: expiresAt?.(),
    };
    // Not awaited: Firestore shows the message right away and settles only
    // once the backend acknowledged it.
    return { saved: addDoc(col, chatMessage) };
  }

  private messagesCol(
    path: string,
    ...pathSegments: string[]
  ): CollectionReference<ChatMessage, ChatMessageDto> {
    return collection(this.fs, path, ...pathSegments).withConverter<
      ChatMessage,
      ChatMessageDto
    >(chatMessageConverter);
  }
}
