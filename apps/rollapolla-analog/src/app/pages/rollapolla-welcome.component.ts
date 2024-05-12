import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, Signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Note } from '../../note';
import { pollAdapter } from '../adapter/polll.adapter';

@Component({
  selector: 'rap-welcome',
  standalone: true,
  imports: [AsyncPipe, FormsModule, DatePipe],
  styleUrl: './rollapolla-welcome.component.scss',
  templateUrl: './rollapolla-welcome.component.html',
})
export class RollapollaWelcomeComponent {
  newNote = '';
  private pollAdapter = pollAdapter();
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
