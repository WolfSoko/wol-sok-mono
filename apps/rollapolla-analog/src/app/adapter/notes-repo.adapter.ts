import { inject, Injectable, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { Timestamp } from '@angular/fire/firestore';
import { DatabaseService, Repo } from '@wolsok/shared-data-access';
import { map } from 'rxjs';
import { Note } from '../../shared/note';
import { NotesRepoPort } from '../ports/notes-repo.port';

interface NoteDTO {
  id: string;
  note: string;
  createdAt: Timestamp;
}

@Injectable()
export class NotesRepoAdapter extends NotesRepoPort {
  private readonly db = inject(DatabaseService);
  private readonly notes: Signal<Note[] | undefined>;
  private readonly notesRepo: Repo<NoteDTO>;

  constructor() {
    super();
    this.notesRepo = this.db.createRepo<NoteDTO>('notes');
    const notes$ = this.notesRepo.data$().pipe(
      map((notes) =>
        notes.map(
          (note: NoteDTO) =>
            ({
              ...note,
              createdAt: note.createdAt.toDate(),
            }) as Note
        )
      )
    );
    this.notes = toSignal(notes$);
  }

  getNotes(): Signal<Note[] | undefined> {
    return this.notes;
  }

  async addNote(note: string): Promise<void> {
    const newNote: Omit<NoteDTO, 'id'> = {
      note,
      createdAt: Timestamp.now(),
    };
    await this.notesRepo.addDoc(newNote);
  }
}
