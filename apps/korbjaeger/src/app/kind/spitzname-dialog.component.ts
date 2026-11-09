import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { SPITZNAME_LAENGE } from '../auswahl/kind';

/** What the dialog asks about: whom, and whether to mark or rename. */
export interface SpitznameFrage {
  /** The player's name as the Kader shows it. */
  readonly name: string;
  /** The Spitzname given so far; none while marking. */
  readonly spitzname?: string;
  readonly aktion: 'markieren' | 'aendern';
}

/** What the dialog closes with once confirmed; cancelled, it gives none. */
export interface SpitznameAntwort {
  /** As typed: the `Auswahl` trims it, empty means none. */
  readonly spitzname: string;
}

const TITEL: Readonly<Record<SpitznameFrage['aktion'], string>> = {
  markieren: 'Als mein Kind markieren',
  aendern: 'Spitzname ändern',
};

const BESTAETIGEN: Readonly<Record<SpitznameFrage['aktion'], string>> = {
  markieren: 'Markieren',
  aendern: 'Speichern',
};

/**
 * Asks for the optional Spitzname of a Kind, when marking it or later.
 * Opened with a `SpitznameFrage`; closes with a `SpitznameAntwort`, or
 * with none where cancelled.
 */
@Component({
  selector: 'korb-spitzname-dialog',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ titel }}</h2>
    <form (submit)="$event.preventDefault(); bestaetigen(eingabe.value)">
      <mat-dialog-content>
        <p>{{ frage.name }}</p>
        <mat-form-field>
          <mat-label>Spitzname (freiwillig)</mat-label>
          <input
            matInput
            #eingabe
            name="spitzname"
            autocomplete="off"
            [attr.maxlength]="laenge"
            [value]="frage.spitzname ?? ''"
          />
          <mat-hint>So heißt dein Kind im Überblick.</mat-hint>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close>Abbrechen</button>
        <button matButton="filled" type="submit">{{ bestaetigenText }}</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    mat-form-field {
      width: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpitznameDialogComponent {
  protected readonly frage = inject<SpitznameFrage>(MAT_DIALOG_DATA);
  protected readonly laenge = SPITZNAME_LAENGE;
  protected readonly titel = TITEL[this.frage.aktion];
  protected readonly bestaetigenText = BESTAETIGEN[this.frage.aktion];

  private readonly dialog =
    inject<MatDialogRef<SpitznameDialogComponent, SpitznameAntwort>>(
      MatDialogRef
    );

  protected bestaetigen(spitzname: string): void {
    this.dialog.close({ spitzname });
  }
}
