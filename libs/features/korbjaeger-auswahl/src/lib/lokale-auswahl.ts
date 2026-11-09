import { computed, signal, type Signal } from '@angular/core';
import type {
  PersonId,
  TeamId,
  VereinId,
} from '@wolsok/feat-shared-basketball-data';
import type { Vereinsfarben } from './vereinsfarben';
import type { VereinsfarbenWahl } from './vereinsfarben-wahl';
import type { Auswahl } from './auswahl';
import {
  abgebenAenderung,
  entfolgenAenderung,
  entmarkierenAenderung,
  folgenAenderung,
  gleicheKinder,
  gleicheVereinsfarben,
  grenzenPruefen,
  inhaltAus,
  markierenAenderung,
  spitznameAenderung,
  teamPlatz,
  vereinsfarbenAenderung,
  vereinsfarbenZuruecksetzenAenderung,
  type AuswahlAenderung,
} from './auswahl-aenderungen';
import {
  auswahlDokumentLesen,
  auswahlDokumentMit,
  auswahlFelder,
  LEERE_AUSWAHL,
  naechsterSeit,
  type AuswahlInhalt,
  type GelesenesDokument,
  type TeamPlatz,
} from './auswahl-dokument';
import { gleicheFolge } from './gleiche-folge';
import type { Kind, MarkierbarerSpieler } from './kind';
import { istSpeicherVoll } from './speicher-voll';
import { AuswahlZuNeuError } from './auswahl-fehler';

/** The key of the `AuswahlDokument` in the device's storage. */
export const AUSWAHL_SCHLUESSEL = 'korbjaeger-selection';

/** The part of the device's storage (`localStorage`) the adapter uses. */
export type GeraeteSpeicher = Pick<Storage, 'getItem' | 'setItem'>;

/** Where the browser tells of changes other tabs made (`window`). */
export type Fenster = Pick<
  EventTarget,
  'addEventListener' | 'removeEventListener'
>;

/**
 * The `Auswahl` on the device, for Elternteile without an account.
 * - It reads the stored `AuswahlDokument` at start, whenever another tab
 *   changed it (the `storage` event on `fenster`, until `beenden`), and
 *   again before each write, so two tabs keep each other's changes.
 * - A document that cannot be read or is none counts as empty; fields it
 *   does not know are kept on a write.
 * - A document of a newer version is left alone: no Team is followed, no
 *   Kind marked, and every change rejects with `AuswahlZuNeuError`.
 * - A change over a list's cap (`AUSWAHL_GRENZEN`) rejects with
 *   `AuswahlVollError`, nothing stored.
 * - Each change reads and writes at once, in the call: stored before it
 *   returns, so leaving the page right after keeps it.
 * - Where the storage is full, it has `platzSchaffen` free it (of the
 *   cached DBB answers) and tries once more. A change it still could not
 *   store (private mode, full, no storage) is kept as `offen`: applied on
 *   top of what is read (another tab's changes too) until a write takes
 *   it, so it lasts at least for this visit.
 */
export class LokaleAuswahl implements Auswahl {
  public readonly teams: Signal<readonly TeamId[]>;
  public readonly kinder: Signal<readonly Kind[]>;
  public readonly vereinsfarben: Signal<readonly VereinsfarbenWahl[]>;
  /** The device's storage is always read, at worst as empty. */
  public readonly nichtLesbar: Signal<boolean> = signal(false).asReadonly();
  /** The device's storage holds the choices, always this one. */
  public readonly quelle: Signal<unknown> = signal(this).asReadonly();

  private readonly inhalt = signal<AuswahlInhalt>(LEERE_AUSWAHL);

  /** This visit's changes no write has stored yet, in their order. */
  private offen: readonly AuswahlAenderung[] = [];

  private readonly beiAenderung = (event: Event): void => {
    if (
      event instanceof StorageEvent &&
      (event.key === null || event.key === AUSWAHL_SCHLUESSEL)
    ) {
      this.anzeigen(this.lesen());
    }
  };

  /**
   * @param platzSchaffen frees the device's storage of what may give way
   *   (the cached DBB answers) when it is full; the selection always wins.
   */
  public constructor(
    private readonly speicher: GeraeteSpeicher | undefined,
    private readonly fenster?: Fenster,
    private readonly platzSchaffen: () => void = () => undefined
  ) {
    // read at once, so `teams` and `kinder` are never undefined here
    this.anzeigen(this.lesen());
    this.teams = computed(() => this.inhalt().teams, { equal: gleicheFolge });
    this.kinder = computed(() => this.inhalt().kinder, {
      equal: gleicheKinder,
    });
    this.vereinsfarben = computed(() => this.inhalt().vereinsfarben, {
      equal: gleicheVereinsfarben,
    });
    fenster?.addEventListener('storage', this.beiAenderung);
  }

  public folgen(team: TeamId, platz?: TeamPlatz): Promise<void> {
    return this.aendern(folgenAenderung(team, platz));
  }

  public entfolgen(team: TeamId): Promise<TeamPlatz | undefined> {
    return this.ausfuehren(entfolgenAenderung(team), (vorher) =>
      teamPlatz(vorher, team)
    );
  }

  public markieren(
    spieler: MarkierbarerSpieler,
    spitzname?: string
  ): Promise<void> {
    return this.aendern(markierenAenderung(spieler, spitzname));
  }

  public spitznameSetzen(
    person: PersonId,
    spitzname: string | undefined
  ): Promise<void> {
    return this.aendern(spitznameAenderung(person, spitzname));
  }

  public entmarkieren(person: PersonId): Promise<void> {
    return this.aendern(entmarkierenAenderung(person));
  }

  public vereinsfarbenSetzen(
    verein: VereinId,
    farben: Vereinsfarben
  ): Promise<void> {
    return this.aendern(vereinsfarbenAenderung(verein, farben));
  }

  public vereinsfarbenZuruecksetzen(verein: VereinId): Promise<void> {
    return this.aendern(vereinsfarbenZuruecksetzenAenderung(verein));
  }

  /**
   * Reads the stored selection now, not waiting for another tab's `storage`
   * event, with the changes still `offen`: what a sign-in takes over.
   */
  public neuGelesen(): AuswahlInhalt {
    this.anzeigen(this.lesen());
    const { teams, kinder, vereinsfarben } = this.inhalt();
    return { teams, kinder, vereinsfarben };
  }

  /**
   * Takes `uebernommen` off the device, once an account holds it, and
   * returns what stays: what joined since it was read (here or in another
   * tab) is left. One read and write, as every change is, which leaves an
   * empty document where nothing stays: it shrinks what is stored, so a
   * full storage takes it. Only a sign-in's takeover calls it.
   */
  public abgeben(uebernommen: AuswahlInhalt): AuswahlInhalt {
    this.aendernJetzt(abgebenAenderung(uebernommen));
    return this.neuGelesen();
  }

  /** Stops listening to other tabs. */
  public beenden(): void {
    this.fenster?.removeEventListener('storage', this.beiAenderung);
  }

  /** Runs `aenderung` now (`aendernJetzt`), its failure as the rejection. */
  private aendern(aenderung: AuswahlAenderung): Promise<void> {
    return this.ausfuehren(aenderung, () => undefined);
  }

  /**
   * Runs `aenderung` now, resolving with `ergebnis` of the state it applied
   * to; its failure as the rejection.
   */
  private ausfuehren<T>(
    aenderung: AuswahlAenderung,
    ergebnis: (vorher: AuswahlInhalt) => T
  ): Promise<T> {
    try {
      return Promise.resolve(ergebnis(this.aendernJetzt(aenderung)));
    } catch (fehler) {
      return Promise.reject(fehler);
    }
  }

  /**
   * Applies `aenderung` to what is stored now, with the changes still
   * `offen`, and stores the result where it changed anything or something
   * was still to be stored. Returns the state it applied `aenderung` to:
   * read from storage at once, so it has the `seit` of every stored Team.
   */
  private aendernJetzt(aenderung: AuswahlAenderung): AuswahlInhalt {
    const gelesen = this.lesen();
    if (gelesen.art === 'neuer') {
      this.anzeigen(gelesen);
      throw new AuswahlZuNeuError();
    }
    const gespeichert = inhaltAus(gelesen);
    const vorher = this.mitOffenen(gespeichert);
    const nachher = aenderung(vorher);
    grenzenPruefen(vorher, nachher);
    this.inhalt.set(nachher);
    if (nachher === vorher && this.offen.length === 0) {
      return vorher;
    }
    const dokument = auswahlDokumentMit(
      gelesen,
      auswahlFelder(gespeichert, nachher, naechsterSeit(gelesen))
    );
    this.offen = this.schreiben(dokument) ? [] : [...this.offen, aenderung];
    return vorher;
  }

  /**
   * Shows what `gelesen` holds, with the changes still `offen`; a newer
   * version's document shows nothing, and those changes are dropped, as
   * they could never be stored over it.
   */
  private anzeigen(gelesen: GelesenesDokument): void {
    if (gelesen.art === 'neuer') {
      this.offen = [];
    }
    this.inhalt.set(this.mitOffenen(inhaltAus(gelesen)));
  }

  /** `inhalt` with the changes still `offen` applied, in their order. */
  private mitOffenen(inhalt: AuswahlInhalt): AuswahlInhalt {
    return this.offen.reduce((stand, aenderung) => aenderung(stand), inhalt);
  }

  private lesen(): GelesenesDokument {
    try {
      const text = this.speicher?.getItem(AUSWAHL_SCHLUESSEL);
      return auswahlDokumentLesen(text ? JSON.parse(text) : undefined);
    } catch {
      return { art: 'keins' };
    }
  }

  /** Stores `dokument`; whether the device took it. */
  private schreiben(dokument: unknown): boolean {
    if (this.speicher === undefined) {
      return false;
    }
    const text = JSON.stringify(dokument);
    try {
      this.speicher.setItem(AUSWAHL_SCHLUESSEL, text);
      return true;
    } catch (error) {
      // blocked: no room to make
      return istSpeicherVoll(error) && this.nachPlatzSchreiben(text);
    }
  }

  /** Has the cached data give way, then tries once more. */
  private nachPlatzSchreiben(text: string): boolean {
    try {
      this.platzSchaffen();
      this.speicher?.setItem(AUSWAHL_SCHLUESSEL, text);
      return true;
    } catch {
      return false;
    }
  }
}
