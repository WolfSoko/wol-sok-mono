import { Timestamp } from '@angular/fire/firestore';

export interface ChatMessageDto {
  message: string;
  createdAt: Timestamp;
  ttl: Timestamp;
  /** Missing on messages from before chatting needed a sign-in. */
  authorUid?: string;
}
