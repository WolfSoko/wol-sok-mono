import { DatePipe } from '@angular/common';
import { Component, inject, output } from '@angular/core';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule, MatIconButton } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'rap-note-form',
  templateUrl: './note-form.component.html',
  styles: `
    .form-field {
      width: 100%;
    }
  `,
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatIconModule,
    MatIconButton,
    MatButtonModule,
    MatInputModule,
  ],
})
export class NoteFormComponent {
  MAX_LENGTH = 300;
  noteAdded = output<string>();
  form = inject(NonNullableFormBuilder).group({
    newNote: [
      '',
      {
        validators: [
          Validators.maxLength(this.MAX_LENGTH),
          Validators.minLength(10),
        ],
      },
    ],
  });

  addNote() {
    const trimmedNote = this.form.value.newNote?.trim();
    this.form.patchValue({ newNote: trimmedNote });

    if (!this.form.value.newNote || !this.form.valid) {
      this.form.markAllAsTouched();
      return;
    }

    this.noteAdded.emit(this.form.getRawValue().newNote);
    this.form.reset({ newNote: '' });
    this.form.markAsUntouched();
    this.form.markAsPristine();
  }
}
