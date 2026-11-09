import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';

/**
 * Asks before the account goes: closes with `true` to delete it, with
 * nothing where cancelled.
 */
@Component({
  selector: 'korb-konto-loeschen-dialog',
  imports: [MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>Konto löschen?</h2>
    <mat-dialog-content>
      Meine Teams und Kinder in diesem Konto werden gelöscht, auf allen Geräten,
      und das Konto selbst. Das lässt sich nicht rückgängig machen.
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton type="button" mat-dialog-close>Abbrechen</button>
      <button
        matButton="filled"
        type="button"
        data-qa="konto-loeschen-bestaetigen"
        [mat-dialog-close]="true"
      >
        Konto löschen
      </button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KontoLoeschenDialogComponent {}
