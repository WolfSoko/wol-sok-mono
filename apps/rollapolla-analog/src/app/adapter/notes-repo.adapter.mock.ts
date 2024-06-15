import { Injectable, signal, Signal, WritableSignal } from '@angular/core';
import { Note } from '../../shared/note';
import { NotesRepoPort } from '../ports/notes-repo.port';

@Injectable()
export class NotesRepoAdapterMock extends NotesRepoPort {
  private readonly notes: WritableSignal<Note[]> = signal([]);

  getNotes(): Signal<Note[] | undefined> {
    return this.notes;
  }

  async addNote(note: string): Promise<void> {
    this.notes.update((notes) => [
      ...notes,
      { id: String(notes.length + 1), note, createdAt: new Date() } as Note,
    ]);
  }
}
