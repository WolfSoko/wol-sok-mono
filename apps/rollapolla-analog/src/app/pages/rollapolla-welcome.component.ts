import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { CreatePollComponent } from '../core/create-poll/create-poll.component';
import { NotesComponent } from '../core/notes/notes.component';

@Component({
  selector: 'rap-welcome',
  imports: [
    FormsModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    NotesComponent,
    CreatePollComponent,
    MatProgressSpinner,
  ],
  styleUrl: './rollapolla-welcome.component.scss',
  templateUrl: './rollapolla-welcome.component.html',
})
export class RollapollaWelcomeComponent {}
