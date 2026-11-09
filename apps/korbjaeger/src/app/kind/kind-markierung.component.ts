import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { firstValueFrom } from 'rxjs';
import { AUSWAHL } from '../auswahl/auswahl';
import type { Kind, MarkierbarerSpieler } from '../auswahl/kind';
import { auswahlAenderung } from '../fehler/auswahl-aenderung';
import {
  SpitznameDialogComponent,
  type SpitznameAntwort,
  type SpitznameFrage,
} from './spitzname-dialog.component';

/**
 * Marks a named player of a followed Team's Kader as the Elternteil's
 * Kind, asking for an optional Spitzname first; a marked one offers to
 * change its Spitzname or to take the mark away. Takes only a
 * `MarkierbarerSpieler`, so an Anonymer Spieler gets none.
 */
@Component({
  selector: 'korb-kind-markierung',
  imports: [MatButtonModule, MatIconModule, MatMenuModule],
  template: `
    @if (kind()) {
      <button
        matIconButton
        type="button"
        data-qa="kind-menue"
        [matMenuTriggerFor]="menue"
        [attr.aria-label]="'Mein Kind ' + name() + ': Markierung ändern'"
      >
        <mat-icon aria-hidden="true">more_vert</mat-icon>
      </button>
      <mat-menu #menue="matMenu">
        <button mat-menu-item type="button" (click)="spitznameAendern()">
          <mat-icon aria-hidden="true">edit</mat-icon>
          Spitzname ändern
        </button>
        <button mat-menu-item type="button" (click)="entmarkieren()">
          <mat-icon aria-hidden="true">star_outline</mat-icon>
          Markierung entfernen
        </button>
      </mat-menu>
    } @else {
      <button
        matIconButton
        type="button"
        data-qa="kind-markieren"
        aria-label="Als mein Kind markieren"
        title="Als mein Kind markieren"
        (click)="markieren()"
      >
        <mat-icon aria-hidden="true">star_outline</mat-icon>
      </button>
    }
    @if (aenderung.fehler(); as text) {
      <p class="fehler" role="alert">{{ text }}</p>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
    }
    .fehler {
      margin: 0;
      color: var(--mat-sys-error);
      white-space: normal;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KindMarkierungComponent {
  public readonly spieler = input.required<MarkierbarerSpieler>();
  /** The player's name as the Kader shows it, for the labels and the dialog. */
  public readonly name = input.required<string>();
  /** The player as a marked Kind; none while unmarked. */
  public readonly kind = input<Kind>();

  private readonly auswahl = inject(AUSWAHL);
  private readonly dialog = inject(MatDialog);

  protected readonly aenderung = auswahlAenderung();

  protected async markieren(): Promise<void> {
    const antwort = await this.fragen({
      name: this.name(),
      aktion: 'markieren',
    });
    if (antwort) {
      const spieler = this.spieler();
      await this.aenderung.ausfuehren(() =>
        this.auswahl.markieren(spieler, antwort.spitzname)
      );
    }
  }

  protected async spitznameAendern(): Promise<void> {
    const antwort = await this.fragen({
      name: this.name(),
      spitzname: this.kind()?.spitzname,
      aktion: 'aendern',
    });
    if (antwort) {
      const person = this.spieler().personId;
      await this.aenderung.ausfuehren(() =>
        this.auswahl.spitznameSetzen(person, antwort.spitzname)
      );
    }
  }

  protected entmarkieren(): Promise<void> {
    const person = this.spieler().personId;
    return this.aenderung.ausfuehren(() => this.auswahl.entmarkieren(person));
  }

  /** Opens the dialog; its answer, or none where it was cancelled. */
  private fragen(frage: SpitznameFrage): Promise<SpitznameAntwort | undefined> {
    const dialog = this.dialog.open<
      SpitznameDialogComponent,
      SpitznameFrage,
      SpitznameAntwort
    >(SpitznameDialogComponent, { data: frage });
    return firstValueFrom(dialog.afterClosed());
  }
}
