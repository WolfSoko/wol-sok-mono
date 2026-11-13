import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_BOTTOM_SHEET_DATA,
  MatBottomSheetRef,
} from '@angular/material/bottom-sheet';
import type { ClubId } from '@wolsok/feat-shared-basketball-data';
import { AUSWAHL } from '../auswahl/auswahl';
import {
  clubColorsFor,
  clubColorsOf,
  type ClubColors,
} from '@wolsok/feat-korbjaeger-selection';
import { selectionChange } from '../errors/selection-change';
import { FarbwahlComponent } from './farbwahl.component';
import { FarbschemaDirective } from './vereinsfarben-anwenden';

/** What the bottom sheet is opened for: a Verein, with its name to show. */
export interface VereinsfarbenBlattDaten {
  readonly vereinId: ClubId;
  readonly vereinName: string;
}

/**
 * The bottom sheet "Vereinsfarben" (#2918): a Verein's colour and an
 * optional second one, from presets or the colour picker, with a preview
 * of how the app looks in them; "Übernehmen" stores them in the `Selection`,
 * "Zurücksetzen" takes them away, so the app's own apply again. A failed
 * change says why and keeps the sheet open.
 */
@Component({
  selector: 'korb-vereinsfarben-blatt',
  imports: [MatButtonModule, FarbwahlComponent, FarbschemaDirective],
  template: `
    <h2>Vereinsfarben</h2>
    <p class="erklaerung">
      Farben für die Teams von {{ daten.vereinName }} in Korbjäger. Texte
      bleiben lesbar: Wo eine Farbe zu hell oder zu dunkel ist, passt die App
      ihren Ton an.
    </p>
    <korb-farbwahl
      data-qa="hauptfarbe"
      legende="Hauptfarbe"
      [(farbe)]="primaer"
    />
    <korb-farbwahl
      data-qa="zweite-farbe"
      legende="Zweite Farbe (optional)"
      mitKeiner
      [(farbe)]="zweite"
    />
    <div class="vorschau" data-qa="vorschau" [korbFarbschema]="vorschau()">
      <p class="vorschau-titel">Vorschau</p>
      <span class="vorschau-knopf">Team folgen</span>
      <span class="vorschau-zweite">Zweite Farbe</span>
      <p class="anzeigetafel vorschau-tafel">Nächstes Spiel</p>
    </div>
    @if (aenderung.error(); as text) {
      <p class="fehler" role="alert">{{ text }}</p>
    }
    <div class="aktionen">
      <button
        matButton="filled"
        type="button"
        [disabled]="vorschau() === undefined || laeuft()"
        (click)="uebernehmen()"
      >
        Übernehmen
      </button>
      @if (gesetzt()) {
        <button
          matButton="outlined"
          type="button"
          [disabled]="laeuft()"
          (click)="zuruecksetzen()"
        >
          Zurücksetzen
        </button>
      }
      <button matButton type="button" (click)="schliessen()">Abbrechen</button>
    </div>
  `,
  styles: `
    :host {
      display: grid;
      gap: 1rem;
      padding-block: 0.5rem 1rem;
    }
    h2,
    p {
      margin: 0;
    }
    .erklaerung {
      color: var(--mat-sys-on-surface-variant);
    }
    .vorschau {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem;
      border-radius: var(--mat-sys-corner-medium);
      background: var(--mat-sys-surface-container);
      color: var(--mat-sys-on-surface);
      border-block-start: var(--korb-linie-breite) solid var(--mat-sys-primary);
    }
    .vorschau-titel {
      flex-basis: 100%;
      font: var(--mat-sys-title-medium);
      font-weight: var(--mat-sys-title-medium-weight);
      color: var(--mat-sys-primary);
    }
    .vorschau-knopf,
    .vorschau-zweite {
      padding: 0.5rem 1rem;
      border-radius: var(--mat-sys-corner-full);
    }
    .vorschau-knopf {
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
    }
    .vorschau-zweite {
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
    }
    .vorschau-tafel {
      flex-basis: 100%;
      padding: 0.75rem;
    }
    .fehler {
      color: var(--mat-sys-error);
    }
    .aktionen {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VereinsfarbenBlattComponent {
  protected readonly daten = inject<VereinsfarbenBlattDaten>(
    MAT_BOTTOM_SHEET_DATA
  );
  private readonly blatt = inject(MatBottomSheetRef);
  private readonly auswahl = inject(AUSWAHL);

  /** The colours the Verein has now; `undefined` for none. */
  protected readonly gesetzt = computed(() =>
    clubColorsFor(this.auswahl.clubColors(), this.daten.vereinId)
  );

  private readonly anfang = untracked(this.gesetzt);
  protected readonly primaer = signal(this.anfang?.primary);
  protected readonly zweite = signal(this.anfang?.secondary);

  /** What the choice looks like; none before a first colour is chosen. */
  protected readonly vorschau = computed((): ClubColors | undefined => {
    const primaer = this.primaer();
    // presets and the colour picker both give #rrggbb
    return primaer === undefined
      ? undefined
      : clubColorsOf(primaer, this.zweite());
  });

  protected readonly aenderung = selectionChange();
  /** Whether a change runs: the buttons wait for it, so a double tap writes once. */
  protected readonly laeuft = signal(false);

  protected async uebernehmen(): Promise<void> {
    const farben = this.vorschau();
    if (farben !== undefined) {
      await this.aendern(() =>
        this.auswahl.setClubColors(this.daten.vereinId, farben)
      );
    }
  }

  protected zuruecksetzen(): Promise<void> {
    return this.aendern(() =>
      this.auswahl.resetClubColors(this.daten.vereinId)
    );
  }

  /** Runs `aenderung` once at a time; closes once it succeeded. */
  private async aendern(aenderung: () => Promise<void>): Promise<void> {
    if (this.laeuft()) {
      return;
    }
    this.laeuft.set(true);
    const erledigt = await this.aenderung.run(aenderung);
    this.laeuft.set(false);
    if (erledigt) {
      this.schliessen();
    }
  }

  protected schliessen(): void {
    this.blatt.dismiss();
  }
}
