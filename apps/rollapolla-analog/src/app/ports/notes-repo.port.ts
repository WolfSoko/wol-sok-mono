import { Signal } from '@angular/core';
import { Note } from '../../shared/note';

export abstract class NotesRepoPort {
  abstract getNotes(): Signal<Note[] | undefined>;
  abstract addNote(newNote: string): void;
}
