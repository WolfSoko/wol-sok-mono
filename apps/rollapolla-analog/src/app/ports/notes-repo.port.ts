import { Signal } from '@angular/core';
import { Note } from '../../shared/note';

export abstract class NotesRepoPort {
  abstract getNotes(): Signal<Note[] | undefined>;
  abstract addNote(newNote: string): void;
  abstract removeNote(id: number): void;
  abstract noteTrackBy(index: number, note: Note): number;
}
