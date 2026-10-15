import {
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
  Timestamp,
} from '@angular/fire/firestore';
import { ChatMessage } from '../../shared/chat.message';
import { ChatMessageDto } from './chat-message.dto';

const SEVEN_DAYS: number = 1000 * 60 * 60 * 24 * 7;
export const chatMessageConverter: FirestoreDataConverter<
  ChatMessage,
  ChatMessageDto
> = {
  toFirestore(chatMessage: ChatMessage): ChatMessageDto {
    return {
      message: chatMessage.message,
      createdAt: Timestamp.fromDate(chatMessage.createdAt),
      ttl: chatMessage.expiresAt
        ? Timestamp.fromDate(chatMessage.expiresAt)
        : Timestamp.fromMillis(chatMessage.createdAt.getTime() + SEVEN_DAYS),
      ...(chatMessage.authorUid ? { authorUid: chatMessage.authorUid } : {}),
      ...(chatMessage.authorName ? { authorName: chatMessage.authorName } : {}),
    };
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot<ChatMessageDto>,
    options?: SnapshotOptions
  ): ChatMessage {
    const data = snapshot.data(options) as ChatMessageDto;
    return {
      id: snapshot.id,
      message: data.message,
      createdAt: new Date(data.createdAt.toDate()),
      authorUid: data.authorUid,
      authorName: data.authorName ?? null,
    };
  },
};
