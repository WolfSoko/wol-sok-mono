import { DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { MatCard, MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { Note } from '../../../shared/note';

@Component({
  selector: 'rap-notes-list',
  template: `@if (notes()) {
      <mat-list class="notes-list" data-testid="notes-list">
        @for (note of notes(); track note.id; let i = $index) {
          <li>
            <mat-card>
              <mat-card-subtitle>
                <span data-testid="note-note">{{ note.note }}</span>
              </mat-card-subtitle>
              <mat-card-footer>
                <span class="mat-label-small">{{
                  note.createdAt | date: 'medium'
                }}</span>
              </mat-card-footer>
            </mat-card>
            <br />
          </li>
        }
        @if (notes()?.length === 0) {
          <div>
            <h4>No notes yet!</h4>
            <p>Add a new one and see them appear here...</p>
          </div>
        }
      </mat-list>
    } @else {
      <ng-template #loading>
        <p class="loading-text">Loading...</p>
      </ng-template>
    }`,
  styles: `
    :host {
      display: block;
      max-height: 480px;
      overflow-y: auto;
    }
    .notes-list {
    }
  `,
  standalone: true,
  imports: [DatePipe, MatListModule, MatCardModule],
})
export class NotesListComponent {
  notes = input<Note[]>();
}
