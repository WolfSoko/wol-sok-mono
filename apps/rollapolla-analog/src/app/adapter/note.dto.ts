import { Timestamp } from '@angular/fire/firestore';

export interface NoteDto {
  note: string;
  createdAt: Timestamp;
  ttl: Timestamp;
}
