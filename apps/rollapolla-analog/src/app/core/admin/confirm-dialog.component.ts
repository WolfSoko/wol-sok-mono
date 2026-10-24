import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

export type ConfirmData = { title: string; text: string; action: string };

/** Asks before something that cannot be undone; closes with `true` if confirmed. */
@Component({
  selector: 'rap-confirm-dialog',
  imports: [MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p class="text">{{ data.text }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="false">
        Cancel
      </button>
      <button
        mat-flat-button
        type="button"
        [mat-dialog-close]="true"
        data-testid="confirm-button"
      >
        {{ data.action }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .text {
      margin: 0;
      overflow-wrap: anywhere;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialogComponent {
  protected readonly data: ConfirmData = inject(MAT_DIALOG_DATA);
}
