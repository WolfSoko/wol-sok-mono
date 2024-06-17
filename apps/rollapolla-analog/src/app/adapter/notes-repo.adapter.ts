import { isPlatformServer } from '@angular/common';
import {
  effect,
  ExperimentalPendingTasks,
  inject,
  Injectable,
  PLATFORM_ID,
  Signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

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
import { Note } from '../../shared/note';
import { NotesRepoPort } from '../ports/notes-repo.port';
import { NoteDto } from './note.dto';
import { notesConverter } from './notes.converter';

@Injectable()
export class NotesRepoAdapter extends NotesRepoPort {
  private readonly fs: Firestore = inject(Firestore);
  private readonly notes: Signal<Note[] | undefined>;
  private readonly notesCol: CollectionReference<Note, NoteDto>;

  constructor() {
    super();
    this.notesCol = collection(this.fs, 'notes').withConverter<Note, NoteDto>(
      notesConverter
    );
    // if is server environment, inform zoneless context to wait for the notes to be loaded

    let cleanup: () => void;
    const isServer = isPlatformServer(inject(PLATFORM_ID));
    if (isServer) {
      cleanup = inject(ExperimentalPendingTasks).add();
    }
    const notes$ = collectionData(
      query(this.notesCol, orderBy('createdAt', 'desc'), limit(20))
    );

    this.notes = toSignal(notes$, { rejectErrors: true });
    if (isServer) {
      effect(() => {
        if (this.notes() === undefined) {
          // give the server 200ms to load the notes
          // otherwise finish rendering
          setTimeout(cleanup, 200);
          return;
        }
        // if notes are loaded, finish rendering
        cleanup();
      });
    }
  }

  getNotes(): Signal<Note[] | undefined> {
    return this.notes;
  }

  async addNote(note: string): Promise<void> {
    const newNote: Note = {
      id: '-1',
      note,
      createdAt: new Date(),
    };
    await addDoc(this.notesCol, newNote);
  }
}
