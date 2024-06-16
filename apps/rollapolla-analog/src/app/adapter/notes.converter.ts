import {
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
  Timestamp,
} from '@angular/fire/firestore';
import { Note } from '../../shared/note';
import { NoteDto } from './note.dto';

const SEVEN_DAYS: number = 1000 * 60 * 60 * 24 * 7;
export const notesConverter: FirestoreDataConverter<Note, NoteDto> = {
  toFirestore(note: Note): NoteDto {
    return {
      note: note.note,
      createdAt: Timestamp.fromDate(note.createdAt),
      ttl: Timestamp.fromMillis(note.createdAt.getTime() + SEVEN_DAYS),
    };
  },
  fromFirestore(
    snapshot: QueryDocumentSnapshot<NoteDto>,
    options?: SnapshotOptions
  ): Note {
    const data = snapshot.data(options) as NoteDto;
    return {
      id: snapshot.id,
      note: data.note,
      createdAt: new Date(data.createdAt.toDate()),
    };
  },
};
