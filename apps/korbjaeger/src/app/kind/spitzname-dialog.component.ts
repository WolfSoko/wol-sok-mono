import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import {
  NICKNAME_LENGTH,
  nicknameCharacterCount,
} from '@wolsok/feat-korbjaeger-selection';

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
 * Counts its characters as the `Auswahl` does (`spitznameZeichen`, an
 * emoji as one) and takes none over `SPITZNAME_LAENGE`. Opened with a
 * `SpitznameFrage`; closes with a `SpitznameAntwort`, or with none where
 * cancelled.
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
    <form (submit)="$event.preventDefault(); bestaetigen()">
      <mat-dialog-content>
        <p>{{ frage.name }}</p>
        <mat-form-field>
          <mat-label>Spitzname (freiwillig)</mat-label>
          <input
            matInput
            #eingabe
            name="spitzname"
            autocomplete="off"
            [value]="eingegeben()"
            (input)="eingegeben.set(eingabe.value)"
            [attr.aria-invalid]="zuLang()"
          />
          @if (zuLang()) {
            <mat-hint class="zu-lang" data-qa="spitzname-zu-lang"
              >Höchstens {{ laenge }} Zeichen</mat-hint
            >
          } @else {
            <mat-hint>So heißt dein Kind im Überblick.</mat-hint>
          }
          <mat-hint align="end" data-qa="spitzname-zaehler"
            >{{ zeichen() }}/{{ laenge }}</mat-hint
          >
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton type="button" mat-dialog-close>Abbrechen</button>
        <button matButton="filled" type="submit" [disabled]="zuLang()">
          {{ bestaetigenText }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    mat-form-field {
      width: 100%;
    }
    .zu-lang {
      color: var(--mat-sys-error);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpitznameDialogComponent {
  protected readonly frage = inject<SpitznameFrage>(MAT_DIALOG_DATA);
  protected readonly laenge = NICKNAME_LENGTH;
  protected readonly titel = TITEL[this.frage.aktion];
  protected readonly bestaetigenText = BESTAETIGEN[this.frage.aktion];
  protected readonly eingegeben = signal(this.frage.spitzname ?? '');
  protected readonly zeichen = computed(() =>
    nicknameCharacterCount(this.eingegeben())
  );
  protected readonly zuLang = computed(() => this.zeichen() > NICKNAME_LENGTH);

  private readonly dialog =
    inject<MatDialogRef<SpitznameDialogComponent, SpitznameAntwort>>(
      MatDialogRef
    );

  protected bestaetigen(): void {
    if (!this.zuLang()) {
      this.dialog.close({ spitzname: this.eingegeben() });
    }
  }
}
