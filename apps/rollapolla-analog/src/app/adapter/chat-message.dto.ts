import { Timestamp } from '@angular/fire/firestore';

export interface ChatMessageDto {
  message: string;
  createdAt: Timestamp;
  ttl: Timestamp;
  authorUid?: string;
  authorName?: string;
}
