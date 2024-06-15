import { CommonModule } from '@angular/common';
import { Component, inject, Signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { Note } from '../../../shared/note';
import { NotesRepoPort } from '../../ports/notes-repo.port';
import { NoteFormComponent } from './note-form.component';
import { NotesListComponent } from './notes-list.component';

@Component({
  selector: 'rap-notes',
  standalone: true,
  imports: [CommonModule, MatCardModule, NotesListComponent, NoteFormComponent],
  templateUrl: './notes.component.html',
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      justify-content: stretch;
      align-items: start;
    }
    .form,
    .notes {
      flex: 1 1 calc(50% - 0.5rem);
    }
  `,
})
export class NotesComponent {
  pollAdapter = inject(NotesRepoPort);
  notes: Signal<Note[] | undefined> = this.pollAdapter.getNotes();

  addNote(note: string) {
    this.pollAdapter.addNote(note.trim());
  }
}
