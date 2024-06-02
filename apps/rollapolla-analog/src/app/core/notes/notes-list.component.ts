import { DatePipe } from '@angular/common';
import { Component, input, output, OutputEmitterRef } from '@angular/core';
import { MatListModule } from '@angular/material/list';
import { Note } from '../../../shared/note';

@Component({
  selector: 'rap-notes-list',
  template: `@if (notes()) {
      <mat-list data-testid="notes-list">
        @for (note of notes(); track noteTrackBy(); let i = $index) {
          <mat-list-item>
            <span matListItemTitle data-testid="note-note">{{
              note.note
            }}</span>
            <span matListItemLine>{{ note.createdAt | date: 'medium' }}</span>
          </mat-list-item>
        }
        @if (notes()?.length === 0) {
          <div>
            <h4 class="mat-title-small">No notes yet!</h4>
            <p>Add a new one and see them appear here...</p>
          </div>
        }
      </mat-list>
    } @else {
      <ng-template #loading>
        <p class="loading-text">Loading...</p>
      </ng-template>
    }`,
  styles: ``,
  standalone: true,
  imports: [DatePipe, MatListModule],
})
export class NotesListComponent {
  notes = input<Note[]>();
  noteTrackBy = input<(index: number, note: Note) => string | number>(
    (index, note) => index
  );
  removeNote: OutputEmitterRef<number> = output<number>();
}
