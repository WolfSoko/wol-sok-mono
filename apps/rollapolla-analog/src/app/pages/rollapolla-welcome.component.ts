import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, Signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormField } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Note } from '../../note';
import { pollAdapter } from '../adapter/poll.adapter';

@Component({
  selector: 'rap-welcome',
  standalone: true,
  imports: [
    AsyncPipe,
    FormsModule,
    DatePipe,
    MatFormField,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
  ],
  styleUrl: './rollapolla-welcome.component.scss',
  templateUrl: './rollapolla-welcome.component.html',
})
export class RollapollaWelcomeComponent {
  newNote = '';
  pollAdapter = pollAdapter();
  notes: Signal<Note[] | undefined> = this.pollAdapter.notes;
  noteTrackBy = this.pollAdapter.noteTrackBy;

  removeNote(id: number) {
    this.pollAdapter.removeNote(id);
  }
  addNote(form: NgForm) {
    if (!form.valid) {
      form.form.markAllAsTouched();
      return;
    }

    // optimistic update
    this.pollAdapter.addNote(this.newNote);
    this.newNote = '';
    form.form.reset();
  }
}
