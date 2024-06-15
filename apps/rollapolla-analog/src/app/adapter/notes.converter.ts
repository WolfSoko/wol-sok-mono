import {
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
  Timestamp,
} from '@angular/fire/firestore';
import { Note } from '../../shared/note';
import { NoteDto } from './note.dto';

export const notesConverter: FirestoreDataConverter<Note, NoteDto> = {
  toFirestore(note: Note): NoteDto {
    return {
      note: note.note,
      createdAt: Timestamp.fromDate(note.createdAt as Date),
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
