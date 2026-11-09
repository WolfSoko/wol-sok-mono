import { computed, signal, type Signal } from '@angular/core';
import type { PersonId, TeamId } from '@wolsok/feat-shared-basketball-data';
import type { Auswahl } from './auswahl';
import {
  auswahlDokumentLesen,
  auswahlDokumentMit,
  LEERE_AUSWAHL,
  type AuswahlInhalt,
  type GelesenesDokument,
} from './auswahl-dokument';
import { gleicheFolge } from '../gleiche-folge';
import { kindMit, type Kind, type MarkierbarerSpieler } from './kind';
import { istSpeicherVoll } from '../geraete-speicher';
import { AuswahlZuNeuError } from './auswahl-fehler';

/** The key of the `AuswahlDokument` in the device's storage. */
export const AUSWAHL_SCHLUESSEL = 'korbjaeger-auswahl';

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
 * - Where the storage is full, it has `platzSchaffen` free it (of the
 *   cached DBB answers) and tries once more. A change it still could not
 *   store (private mode, full, no storage) is kept as `offen`: applied on
 *   top of what is read (another tab's changes too) until a write takes
 *   it, so it lasts at least for this visit.
 */
export class LokaleAuswahl implements Auswahl {
  public readonly teams: Signal<readonly TeamId[]>;
  public readonly kinder: Signal<readonly Kind[]>;

  private readonly inhalt = signal<AuswahlInhalt>(LEERE_AUSWAHL);

  /** This visit's changes no write has stored yet, in their order. */
  private offen: ReadonlyArray<(inhalt: AuswahlInhalt) => AuswahlInhalt> = [];

  private readonly beiAenderung = (event: Event): void => {
    if (
      event instanceof StorageEvent &&
      (event.key === null || event.key === AUSWAHL_SCHLUESSEL)
    ) {
      this.inhalt.set(this.mitOffenen(inhaltAus(this.lesen())));
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
    this.inhalt.set(inhaltAus(this.lesen()));
    this.teams = computed(() => this.inhalt().teams, { equal: gleicheFolge });
    this.kinder = computed(() => this.inhalt().kinder, {
      equal: (a, b) => gleicheFolge(a, b, gleichesKind),
    });
    fenster?.addEventListener('storage', this.beiAenderung);
  }

  public async folgen(team: TeamId): Promise<void> {
    this.aendern((inhalt) =>
      inhalt.teams.includes(team)
        ? inhalt
        : { ...inhalt, teams: [...inhalt.teams, team] }
    );
  }

  public async entfolgen(team: TeamId): Promise<void> {
    this.aendern((inhalt) =>
      inhalt.teams.includes(team)
        ? { ...inhalt, teams: inhalt.teams.filter((id) => id !== team) }
        : inhalt
    );
  }

  public async markieren(
    spieler: MarkierbarerSpieler,
    spitzname?: string
  ): Promise<void> {
    this.aendern((inhalt) =>
      istMarkiert(inhalt, spieler.personId)
        ? inhalt
        : {
            ...inhalt,
            kinder: [...inhalt.kinder, kindMit(spieler.personId, spitzname)],
          }
    );
  }

  public async spitznameSetzen(
    person: PersonId,
    spitzname: string | undefined
  ): Promise<void> {
    const neu = kindMit(person, spitzname);
    this.aendern((inhalt) =>
      inhalt.kinder.some(
        (kind) => kind.personId === person && kind.spitzname !== neu.spitzname
      )
        ? {
            ...inhalt,
            kinder: inhalt.kinder.map((kind) =>
              kind.personId === person ? neu : kind
            ),
          }
        : inhalt
    );
  }

  public async entmarkieren(person: PersonId): Promise<void> {
    this.aendern((inhalt) =>
      istMarkiert(inhalt, person)
        ? {
            ...inhalt,
            kinder: inhalt.kinder.filter((kind) => kind.personId !== person),
          }
        : inhalt
    );
  }

  /** Stops listening to other tabs. */
  public beenden(): void {
    this.fenster?.removeEventListener('storage', this.beiAenderung);
  }

  /**
   * Applies `aenderung` to what is stored now, with the changes still
   * `offen`, and stores the result where it changed anything or something
   * was still to be stored.
   */
  private aendern(aenderung: (inhalt: AuswahlInhalt) => AuswahlInhalt): void {
    const gelesen = this.lesen();
    if (gelesen.art === 'neuer') {
      this.offen = [];
      this.inhalt.set(LEERE_AUSWAHL);
      throw new AuswahlZuNeuError();
    }
    const gespeichert = inhaltAus(gelesen);
    const vorher = this.mitOffenen(gespeichert);
    const nachher = aenderung(vorher);
    this.inhalt.set(nachher);
    if (nachher === vorher && this.offen.length === 0) {
      return;
    }
    const dokument =
      gelesen.art === 'aktuell'
        ? auswahlDokumentMit(geaendert(gespeichert, nachher), gelesen.roh)
        : auswahlDokumentMit(nachher);
    this.offen = this.schreiben(dokument) ? [] : [...this.offen, aenderung];
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

function inhaltAus(gelesen: GelesenesDokument): AuswahlInhalt {
  return gelesen.art === 'aktuell' ? gelesen : LEERE_AUSWAHL;
}

function istMarkiert(inhalt: AuswahlInhalt, person: PersonId): boolean {
  return inhalt.kinder.some((kind) => kind.personId === person);
}

/**
 * The parts of `nachher` a change made anew, so a write leaves the others
 * as stored (Kinder this version could not read among them).
 */
function geaendert(
  vorher: AuswahlInhalt,
  nachher: AuswahlInhalt
): Partial<AuswahlInhalt> {
  return {
    ...(nachher.teams !== vorher.teams && { teams: nachher.teams }),
    ...(nachher.kinder !== vorher.kinder && { kinder: nachher.kinder }),
  };
}

function gleichesKind(a: Kind, b: Kind): boolean {
  return a.personId === b.personId && a.spitzname === b.spitzname;
}
