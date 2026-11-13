import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';

/** What deleting does, started in the confirm's click. */
export interface DeleteAccountQuestion {
  /**
   * Deletes the account. Called in the click itself, as it opens Google's
   * popup first, which browsers (Safari) block once the click is over.
   */
  readonly deleteAccount: () => void;
}

/** Asks before the account goes, and starts the deletion once confirmed. */
@Component({
  selector: 'korb-delete-account-dialog',
  imports: [MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>Konto löschen?</h2>
    <mat-dialog-content>
      Meine Teams und Kinder in diesem Konto werden gelöscht, auf allen Geräten,
      und das Konto selbst. Google fragt dich vorher noch einmal. Das lässt sich
      nicht rückgängig machen.
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton type="button" mat-dialog-close>Abbrechen</button>
      <button
        matButton="filled"
        type="button"
        data-qa="delete-account-confirm"
        (click)="confirm()"
      >
        Konto löschen
      </button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeleteAccountDialogComponent {
  private readonly question = inject<DeleteAccountQuestion>(MAT_DIALOG_DATA);
  private readonly dialog = inject(MatDialogRef);

  protected confirm(): void {
    this.question.deleteAccount();
    this.dialog.close();
  }
}
