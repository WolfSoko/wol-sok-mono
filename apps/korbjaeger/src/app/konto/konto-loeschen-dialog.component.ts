import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';

/** What deleting does, started in the confirm's click. */
export interface KontoLoeschenFrage {
  /**
   * Deletes the account. Called in the click itself, as it opens Google's
   * popup first, which browsers (Safari) block once the click is over.
   */
  readonly loeschen: () => void;
}

/** Asks before the account goes, and starts the deletion once confirmed. */
@Component({
  selector: 'korb-konto-loeschen-dialog',
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
        data-qa="konto-loeschen-bestaetigen"
        (click)="bestaetigen()"
      >
        Konto löschen
      </button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KontoLoeschenDialogComponent {
  private readonly frage = inject<KontoLoeschenFrage>(MAT_DIALOG_DATA);
  private readonly dialog = inject(MatDialogRef);

  protected bestaetigen(): void {
    this.frage.loeschen();
    this.dialog.close();
  }
}
