import { Timestamp } from '@angular/fire/firestore';

// @deprecated use ChatMessageDto
export interface NoteDto {
  note: string;
  createdAt: Timestamp;
  ttl: Timestamp;
}
