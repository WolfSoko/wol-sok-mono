import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { TranslatePipe } from '../i18n/translate.pipe';
import { SupportCardComponent } from './support-card.component';

export const SUPPORT_DIALOG_HEADING_ID = 'bacteria-game-support-heading';

/** The Play tips, opened from the main menu inside the Play Store app. */
@Component({
  selector: 'feat-lazy-bac-game-support-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    SupportCardComponent,
    TranslatePipe,
  ],
  template: `
    <h2 mat-dialog-title [id]="headingId">
      {{ 'support.dialogTitle' | t }}
    </h2>
    <mat-dialog-content>
      <feat-lazy-bac-game-support-card />
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>
        {{ 'support.close' | t }}
      </button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportDialogComponent {
  protected readonly headingId = SUPPORT_DIALOG_HEADING_ID;
}
