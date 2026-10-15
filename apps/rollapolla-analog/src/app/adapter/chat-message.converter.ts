import {
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
  Timestamp,
} from '@angular/fire/firestore';
import { ChatMessage } from '../../shared/chat.message';
import { ChatMessageDto } from './chat-message.dto';

const SEVEN_DAYS: number = 1000 * 60 * 60 * 24 * 7;

/** A message to store now, written by the signed-in visitor `authorUid`. */
export function newChatMessageDto(
  message: string,
  authorUid: string,
  createdAt: Date = new Date()
): ChatMessageDto {
  return {
    message,
    createdAt: Timestamp.fromDate(createdAt),
    ttl: Timestamp.fromMillis(createdAt.getTime() + SEVEN_DAYS),
    authorUid,
  };
}

/** Reads chat messages. Writing goes through `newChatMessageDto`. */
export const chatMessageConverter: FirestoreDataConverter<
  ChatMessage,
  ChatMessageDto
> = {
  toFirestore(chatMessage: ChatMessage): never {
    throw new Error(
      `Write a ChatMessageDto instead ${JSON.stringify(chatMessage)}`
    );
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
    };
  },
};
