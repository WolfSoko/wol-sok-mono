import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, Signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormField } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Note } from '../../shared/note';
import { notesAdapter } from '../adapter/notes-repo.adapter';
import { NotesComponent } from '../core/notes/notes.component';

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
    NotesComponent,
  ],
  styleUrl: './rollapolla-welcome.component.scss',
  templateUrl: './rollapolla-welcome.component.html',
})
export class RollapollaWelcomeComponent {}
