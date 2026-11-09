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
import { firstValueFrom } from 'rxjs';
import { AuswahlZuNeuError } from '../auswahl/auswahl-fehler';
import { auswahlFehlerText } from '../fehler/auswahl-fehler-text';
import { KONTO_SITZUNG } from './konto';
import { AnmeldungAbgebrochen } from './konto-dienst';
import { KontoLoeschenDialogComponent } from './konto-loeschen-dialog.component';

/** What the settings say when a step of the account failed. */
const FEHLER = {
  anmelden: 'Die Anmeldung hat nicht geklappt. Bitte noch einmal versuchen.',
  abmelden: 'Das Abmelden hat nicht geklappt. Bitte noch einmal versuchen.',
  loeschen: 'Das Konto ist noch nicht gelöscht. Bitte noch einmal versuchen.',
} as const;

type Schritt = keyof typeof FEHLER;

/**
 * The settings: the Google account, which keeps Meine Teams and Kinder the
 * same on every device signed in with it. Signing in, out and deleting go
 * through `KONTO_SITZUNG`; a popup closed by the Elternteil shows nothing.
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
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EinstellungenComponent {
  private readonly sitzung = inject(KONTO_SITZUNG);
  private readonly dialog = inject(MatDialog);

  protected readonly stand = this.sitzung.stand;
  protected readonly fehler = signal<string | undefined>(undefined);
  protected readonly beschaeftigt = signal(false);

  protected readonly angemeldetAls = computed(() => {
    const stand = this.stand();
    return stand.art === 'angemeldet' && stand.name
      ? `Angemeldet als ${stand.name}`
      : 'Angemeldet mit Google';
  });

  protected anmelden(): Promise<void> {
    return this.ausfuehren('anmelden', () => this.sitzung.anmelden());
  }

  protected abmelden(): Promise<void> {
    return this.ausfuehren('abmelden', () => this.sitzung.abmelden());
  }

  protected async loeschen(): Promise<void> {
    const bestaetigt = await firstValueFrom(
      this.dialog
        .open<KontoLoeschenDialogComponent, void, boolean>(
          KontoLoeschenDialogComponent
        )
        .afterClosed()
    );
    if (bestaetigt === true) {
      await this.ausfuehren('loeschen', () => this.sitzung.loeschen());
    }
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
  if (fehler instanceof AnmeldungAbgebrochen && schritt === 'anmelden') {
    return undefined;
  }
  return fehler instanceof AuswahlZuNeuError
    ? auswahlFehlerText(fehler)
    : FEHLER[schritt];
}
