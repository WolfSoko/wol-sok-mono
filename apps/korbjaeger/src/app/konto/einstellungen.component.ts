import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AuswahlZuNeuError } from '../auswahl/auswahl-fehler';
import { auswahlFehlerText } from '../fehler/auswahl-fehler-text';
import { KONTO_SITZUNG } from './konto';
import { nichtUebernommenText } from './nicht-uebernommen-text';
import {
  AnmeldungAbgebrochen,
  OhneInternet,
  PopupBlockiert,
} from './konto-dienst';
import {
  KontoLoeschenDialogComponent,
  type KontoLoeschenFrage,
} from './konto-loeschen-dialog.component';

/** What the settings say when a step of the account failed. */
const FEHLER = {
  anmelden: 'Die Anmeldung hat nicht geklappt. Bitte noch einmal versuchen.',
  abmelden: 'Das Abmelden hat nicht geklappt. Bitte noch einmal versuchen.',
  loeschen: 'Das Konto ist noch nicht gelöscht. Bitte noch einmal versuchen.',
} as const;

const POPUP_BLOCKIERT =
  'Dein Browser hat das Fenster von Google blockiert. Erlaube Pop-ups für diese Seite und versuche es noch einmal.';

const LOESCHEN_OHNE_INTERNET =
  'Ohne Internet lässt sich das Konto nicht löschen. Bitte versuche es mit Internet noch einmal.';

const LOESCHEN_ABGEBROCHEN =
  'Das Konto ist nicht gelöscht: Die Bestätigung bei Google wurde abgebrochen.';

type Schritt = keyof typeof FEHLER;

/**
 * The settings: the Google account, which keeps Meine Teams and Kinder the
 * same on every device signed in with it. Signing in, out and deleting go
 * through `KONTO_SITZUNG`, which loads Firebase as the page opens, so a
 * click opens Google's popup at once; a popup closed while signing in
 * shows nothing.
 */
@Component({
  selector: 'korb-einstellungen',
  imports: [MatButtonModule, MatCardModule, MatProgressBarModule],
  template: `
    <h1>Einstellungen</h1>
    @switch (stand().art) {
      @case ('aus') {
        <p>Hier gibt es noch nichts einzustellen.</p>
      }
      @default {
        <mat-card appearance="outlined">
          <mat-card-header>
            <mat-card-title>Konto</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            @switch (stand().art) {
              @case ('abgemeldet') {
                <p>
                  Ohne Konto bleiben Meine Teams und Kinder auf diesem Gerät.
                  Mit einem Google-Konto sind sie auf jedem Gerät gleich, auf
                  dem ihr damit angemeldet seid.
                </p>
              }
              @case ('laedt') {
                <mat-progress-bar mode="indeterminate" />
                <p>Dein Konto wird geöffnet …</p>
              }
              @case ('angemeldet') {
                <p data-qa="konto-name">{{ angemeldetAls() }}</p>
                <p>
                  Meine Teams und Kinder sind in deinem Konto gespeichert.
                  Abmelden nimmt sie von diesem Gerät.
                </p>
              }
              @case ('nicht-erreichbar') {
                <p role="alert">
                  Dein Konto lässt sich gerade nicht öffnen. Bitte die App neu
                  laden.
                </p>
              }
            }
            @if (uebrigText(); as text) {
              <p class="hinweis" data-qa="nicht-uebernommen">{{ text }}</p>
            }
            @if (fehler(); as text) {
              <p class="fehler" role="alert">{{ text }}</p>
            }
          </mat-card-content>
          <mat-card-actions>
            @switch (stand().art) {
              @case ('abgemeldet') {
                <button
                  matButton="filled"
                  type="button"
                  data-qa="anmelden"
                  [disabled]="beschaeftigt()"
                  (click)="anmelden()"
                >
                  Mit Google anmelden
                </button>
              }
              @case ('angemeldet') {
                <button
                  matButton="outlined"
                  type="button"
                  data-qa="abmelden"
                  [disabled]="beschaeftigt()"
                  (click)="abmelden()"
                >
                  Abmelden
                </button>
                <button
                  matButton
                  type="button"
                  data-qa="konto-loeschen"
                  [disabled]="beschaeftigt()"
                  (click)="loeschen()"
                >
                  Konto löschen
                </button>
              }
            }
          </mat-card-actions>
        </mat-card>
      }
    }
  `,
  styles: `
    mat-card-actions {
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .fehler {
      color: var(--mat-sys-error);
    }
    .hinweis {
      color: var(--mat-sys-on-surface-variant);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EinstellungenComponent {
  private readonly sitzung = inject(KONTO_SITZUNG);
  private readonly dialog = inject(MatDialog);

  protected readonly stand = this.sitzung.stand;
  protected readonly fehler = signal<string | undefined>(undefined);
  protected readonly beschaeftigt = signal(false);
  /** What of the device's choices did not fit into the account at sign-in. */
  protected readonly uebrigText = signal<string | undefined>(undefined);

  public constructor() {
    // a failure shows when signing in, not before
    this.sitzung.vorbereiten().catch(() => undefined);
  }

  protected readonly angemeldetAls = computed(() => {
    const stand = this.stand();
    return stand.art === 'angemeldet' && stand.name
      ? `Angemeldet als ${stand.name}`
      : 'Angemeldet mit Google';
  });

  protected anmelden(): Promise<void> {
    this.uebrigText.set(undefined);
    return this.ausfuehren('anmelden', async () =>
      this.uebrigText.set(nichtUebernommenText(await this.sitzung.anmelden()))
    );
  }

  protected abmelden(): Promise<void> {
    return this.ausfuehren('abmelden', () => this.sitzung.abmelden());
  }

  protected loeschen(): void {
    this.dialog.open<KontoLoeschenDialogComponent, KontoLoeschenFrage>(
      KontoLoeschenDialogComponent,
      {
        data: {
          loeschen: () =>
            void this.ausfuehren('loeschen', () => this.sitzung.loeschen()),
        },
      }
    );
  }

  private async ausfuehren(
    schritt: Schritt,
    tun: () => Promise<void>
  ): Promise<void> {
    this.fehler.set(undefined);
    this.beschaeftigt.set(true);
    try {
      await tun();
    } catch (fehler) {
      this.fehler.set(fehlerText(schritt, fehler));
    } finally {
      this.beschaeftigt.set(false);
    }
  }
}

/** What to say of `fehler` in `schritt`; nothing for a popup closed while signing in. */
function fehlerText(schritt: Schritt, fehler: unknown): string | undefined {
  if (fehler instanceof AnmeldungAbgebrochen) {
    return schritt === 'loeschen' ? LOESCHEN_ABGEBROCHEN : undefined;
  }
  if (fehler instanceof PopupBlockiert) {
    return POPUP_BLOCKIERT;
  }
  if (fehler instanceof OhneInternet) {
    return LOESCHEN_OHNE_INTERNET;
  }
  return fehler instanceof AuswahlZuNeuError
    ? auswahlFehlerText(fehler)
    : FEHLER[schritt];
}
