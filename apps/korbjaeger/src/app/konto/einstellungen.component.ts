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
import { DarstellungWahlComponent } from '../darstellung/darstellung-wahl.component';
import { AuswahlZuNeuError } from '@wolsok/feat-korbjaeger-auswahl';
import { auswahlFehlerText } from '../fehler/auswahl-fehler-text';
import { KONTO_SITZUNG } from './konto';
import { nichtUebernommenText } from './nicht-uebernommen-text';
import {
  AnmeldungAbgebrochen,
  KontoGewechselt,
  KontoNichtGeloescht,
  NichtAllesGesendet,
  OhneInternet,
  PopupBlockiert,
} from './konto-dienst';
import type { Schritt } from './konto-sitzung';
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

const NICHT_ALLES_GESENDET =
  'Noch sind nicht alle Änderungen bei deinem Konto angekommen. Melde dich ab, sobald du wieder online bist.';

const LOESCHEN_ABGEBROCHEN =
  'Das Konto ist nicht gelöscht: Die Bestätigung bei Google wurde abgebrochen.';

const KONTO_GEWECHSELT =
  'Das Konto ist nicht gelöscht: In einem anderen Tab ist inzwischen ein anderes Konto angemeldet.';

const KONTO_NICHT_GELOESCHT =
  'Deine Teams und Kinder sind gelöscht, dein Konto selbst noch nicht. Bitte lösche es noch einmal.';

/**
 * The settings: the look (`korb-darstellung-wahl`) and the Google account,
 * which keeps Meine Teams and Kinder the same on every device signed in
 * with it. Signing in, out and deleting go
 * through `KONTO_SITZUNG`, which loads Firebase as the page opens, so a
 * click opens Google's popup at once; a popup closed while signing in
 * shows nothing.
 */
@Component({
  selector: 'korb-einstellungen',
  imports: [
    DarstellungWahlComponent,
    MatButtonModule,
    MatCardModule,
    MatProgressBarModule,
  ],
  template: `
    <h1>Einstellungen</h1>
    <korb-darstellung-wahl />
    @if (stand().art !== 'aus') {
      <mat-card appearance="outlined">
        <mat-card-header>
          <mat-card-title>Konto</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          @switch (stand().art) {
            @case ('abgemeldet') {
              <p>
                Ohne Konto bleiben Meine Teams und Kinder auf diesem Gerät. Mit
                einem Google-Konto sind sie auf jedem Gerät gleich, auf dem ihr
                damit angemeldet seid.
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
          @if (laufend() === 'loeschen') {
            <p class="hinweis" data-qa="loeschen-laeuft">
              Das Konto wird gelöscht. Ohne Internet wartet das, bis dein Gerät
              wieder online ist; lass die App so lange offen.
            </p>
          }
          @if (geraetBehalten()) {
            <p class="hinweis" data-qa="geraet-behalten">
              {{ GERAET_BEHALTEN }}
            </p>
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
                [disabled]="beschaeftigt() || !bereit()"
                (click)="anmelden()"
              >
                Mit Google anmelden
              </button>
              @if (vorbereitenFehlgeschlagen()) {
                <p
                  class="fehler"
                  role="alert"
                  data-qa="vorbereiten-fehlgeschlagen"
                >
                  Die Anmeldung ließ sich nicht laden. Bitte prüfe die
                  Internetverbindung.
                </p>
                <button
                  matButton
                  type="button"
                  data-qa="vorbereiten-erneut"
                  (click)="vorbereiten()"
                >
                  Erneut versuchen
                </button>
              } @else if (!bereit()) {
                <p class="hinweis" data-qa="anmeldung-vorbereiten">
                  Anmeldung wird vorbereitet …
                </p>
              }
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
  `,
  styles: `
    :host {
      display: grid;
      gap: 1rem;
      align-content: start;
    }
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
  /** The step running, also one started before this page opened. */
  protected readonly laufend = this.sitzung.laeuft;
  protected readonly beschaeftigt = computed(
    () => this.laufend() !== undefined
  );
  /** What the last step that failed says, also one before this page opened. */
  protected readonly fehler = computed(() => {
    const fehlschlag = this.sitzung.fehlschlag();
    return fehlschlag && fehlerText(fehlschlag.art, fehlschlag.fehler);
  });
  /** What of the device's choices did not fit into the account shown. */
  protected readonly uebrigText = computed(() => {
    const uebernahme = this.sitzung.uebernahme();
    return uebernahme && nichtUebernommenText(uebernahme.uebrig);
  });
  /** Choices of the device not in the account shown yet, for the next start. */
  protected readonly geraetBehalten = computed(
    () => this.sitzung.uebernahme()?.behalten ?? false
  );
  /** Firebase is loaded, so a click opens Google's popup at once. */
  protected readonly bereit = this.sitzung.bereit;
  /** Firebase could not be loaded (offline, a chunk a release removed). */
  protected readonly vorbereitenFehlgeschlagen = signal(false);
  protected readonly GERAET_BEHALTEN =
    'Einige Änderungen dieses Geräts sind noch nicht in deinem Konto. Sie bleiben auf dem Gerät und kommen beim nächsten Öffnen der App dazu.';

  public constructor() {
    void this.vorbereiten();
  }

  protected readonly angemeldetAls = computed(() => {
    const stand = this.stand();
    return stand.art === 'angemeldet' && stand.name
      ? `Angemeldet als ${stand.name}`
      : 'Angemeldet mit Google';
  });

  /** Loads Firebase ahead of the click; says so where that fails. */
  protected async vorbereiten(): Promise<void> {
    this.vorbereitenFehlgeschlagen.set(false);
    try {
      await this.sitzung.vorbereiten();
    } catch {
      this.vorbereitenFehlgeschlagen.set(true);
    }
  }

  // each step's failure shows through `fehler`, from the session
  protected anmelden(): Promise<void> {
    return this.sitzung.anmelden().then(
      () => undefined,
      () => undefined
    );
  }

  protected abmelden(): Promise<void> {
    return this.sitzung.abmelden().catch(() => undefined);
  }

  protected loeschen(): void {
    this.dialog.open<KontoLoeschenDialogComponent, KontoLoeschenFrage>(
      KontoLoeschenDialogComponent,
      {
        data: {
          loeschen: () => void this.sitzung.loeschen().catch(() => undefined),
        },
      }
    );
  }
}

/**
 * What to say of `fehler` in `schritt`; nothing for a popup closed while
 * signing in, nor for a takeover at the start, whose notice tells it.
 */
function fehlerText(schritt: Schritt, fehler: unknown): string | undefined {
  if (schritt === 'uebernehmen') {
    return undefined;
  }
  if (fehler instanceof KontoGewechselt) {
    return KONTO_GEWECHSELT;
  }
  if (fehler instanceof KontoNichtGeloescht) {
    return KONTO_NICHT_GELOESCHT;
  }
  if (fehler instanceof AnmeldungAbgebrochen) {
    return schritt === 'loeschen' ? LOESCHEN_ABGEBROCHEN : undefined;
  }
  if (fehler instanceof PopupBlockiert) {
    return POPUP_BLOCKIERT;
  }
  if (fehler instanceof OhneInternet) {
    return LOESCHEN_OHNE_INTERNET;
  }
  if (fehler instanceof NichtAllesGesendet) {
    return NICHT_ALLES_GESENDET;
  }
  return fehler instanceof AuswahlZuNeuError
    ? auswahlFehlerText(fehler)
    : FEHLER[schritt];
}
