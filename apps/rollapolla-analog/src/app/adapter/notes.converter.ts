import {
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
} from '@angular/fire/firestore';
import { ChatMessage } from '../../shared/chat.message';
import { NoteDto } from './note.dto';

export const notesConverter: FirestoreDataConverter<ChatMessage, NoteDto> = {
  toFirestore(note: ChatMessage): never {
    throw new Error(`Don't use this anymore ${note}`);
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot<NoteDto>,
    options?: SnapshotOptions
  ): ChatMessage {
    const data = snapshot.data(options) as NoteDto;
    return {
      id: snapshot.id,
      message: data.note,
      createdAt: new Date(data.createdAt.toDate()),
    };
  },
};
