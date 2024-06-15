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
  styles: ``,
})
export class NotesComponent {
  pollAdapter = inject(NotesRepoPort);
  notes: Signal<Note[] | undefined> = this.pollAdapter.getNotes();

  addNote(note: string) {
    this.pollAdapter.addNote(note);
  }
}
