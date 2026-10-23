import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { SupportCardComponent } from './support-card.component';

export const SUPPORT_DIALOG_HEADING_ID = 'bacteria-game-support-heading';

/** The Play tips, opened from the main menu inside the Play Store app. */
@Component({
  selector: 'feat-lazy-bac-game-support-dialog',
  imports: [MatButtonModule, MatDialogModule, SupportCardComponent],
  template: `
    <h2 mat-dialog-title [id]="headingId">Support Bacteria Wars</h2>
    <mat-dialog-content>
      <feat-lazy-bac-game-support-card />
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportDialogComponent {
  protected readonly headingId = SUPPORT_DIALOG_HEADING_ID;
}
