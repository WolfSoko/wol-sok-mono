import { computed, signal, type Signal } from '@angular/core';
import type { PersonId, TeamId } from '@wolsok/feat-shared-basketball-data';
import {
  doc,
  type DocumentReference,
  type Firestore,
  getDoc,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import type { Auswahl } from './auswahl';
import {
  entfolgenAenderung,
  entmarkierenAenderung,
  folgenAenderung,
  geaendert,
  gleicheKinder,
  inhaltAus,
  markierenAenderung,
  spitznameAenderung,
  type AuswahlAenderung,
} from './auswahl-aenderungen';
import {
  AUSWAHL_VERSION,
  auswahlDokumentLesen,
  type GelesenesDokument,
} from './auswahl-dokument';
import { AuswahlZuNeuError } from './auswahl-fehler';
import { gleicheFolge } from '../gleiche-folge';
import type { Kind, MarkierbarerSpieler } from './kind';

/** The collection of the signed-in Elternteile's `AuswahlDokument`s, one per uid. */
export const AUSWAHL_SAMMLUNG = 'auswahl';

/**
 * How long a change waits for Firestore to confirm it before it counts as
 * done: offline it never would, and the change shows (and is kept in the
 * device's cache, sent once online) all the same.
 */
export const BESTAETIGUNG_WARTEN_MS = 3000;

/** The document of the Elternteil `uid` in `firestore`. */
export function auswahlDokumentVon(
  firestore: Firestore,
  uid: string
): DocumentReference {
  return doc(firestore, AUSWAHL_SAMMLUNG, uid);
}

/**
 * The `Auswahl` of a signed-in Elternteil: their `AuswahlDokument` in
 * Firestore, `auswahl/{uid}`, the same on every device signed in with the
 * account.
 * - It shows what the document holds, as Firestore tells it (other devices'
 *   changes too, until `beenden`); `teams` and `kinder` are `undefined`
 *   until the first answer (`geladen`).
 * - A change reads the document first, so it keeps what another device
 *   changed since, and writes only the list it changes (with the version;
 *   both, one of them empty, into a new document): fields it does not know
 *   stay, and the rules check one list a write.
 * - A document that is none counts as empty; a newer version's is left
 *   alone, every change rejected with `AuswahlZuNeuError`.
 * - Offline, a change shows at once and is sent once online; it resolves
 *   after `BESTAETIGUNG_WARTEN_MS` without waiting for that.
 */
export class FirestoreAuswahl implements Auswahl {
  public readonly teams: Signal<readonly TeamId[] | undefined>;
  public readonly kinder: Signal<readonly Kind[] | undefined>;

  private readonly gelesen = signal<GelesenesDokument | undefined>(undefined);
  private readonly dokument: DocumentReference;
  private readonly abbestellen: Unsubscribe;
  private readonly erstesLesen: Promise<void>;

  public constructor(
    firestore: Firestore,
    uid: string,
    private readonly warten: (ms: number) => Promise<void> = pause
  ) {
    this.dokument = auswahlDokumentVon(firestore, uid);
    const inhalt = computed(() => {
      const gelesen = this.gelesen();
      return gelesen === undefined ? undefined : inhaltAus(gelesen);
    });
    this.teams = computed(() => inhalt()?.teams, {
      equal: (a, b) => a === b || (!!a && !!b && gleicheFolge(a, b)),
    });
    this.kinder = computed(() => inhalt()?.kinder, {
      equal: (a, b) => a === b || (!!a && !!b && gleicheKinder(a, b)),
    });
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    this.erstesLesen = promise;
    this.abbestellen = onSnapshot(
      this.dokument,
      (stand) => {
        this.gelesen.set(auswahlDokumentLesen(stand.data()));
        resolve();
      },
      reject
    );
  }

  /** Resolves once the document was read the first time. */
  public geladen(): Promise<void> {
    return this.erstesLesen;
  }

  public folgen(team: TeamId): Promise<void> {
    return this.aendern(folgenAenderung(team));
  }

  public entfolgen(team: TeamId): Promise<void> {
    return this.aendern(entfolgenAenderung(team));
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

  /** Stops listening to the document. */
  public beenden(): void {
    this.abbestellen();
  }

  /**
   * Applies `aenderung` to the document as it is now and writes the list it
   * changed, if any.
   */
  private async aendern(aenderung: AuswahlAenderung): Promise<void> {
    const gelesen = auswahlDokumentLesen((await getDoc(this.dokument)).data());
    if (gelesen.art === 'neuer') {
      this.gelesen.set(gelesen);
      throw new AuswahlZuNeuError();
    }
    const vorher = inhaltAus(gelesen);
    const nachher = aenderung(vorher);
    if (nachher === vorher) {
      return;
    }
    // a new document gets both lists, as a document without its Teams is none
    await this.schreiben({
      version: AUSWAHL_VERSION,
      ...(gelesen.art === 'aktuell' ? geaendert(vorher, nachher) : nachher),
    });
  }

  /**
   * Writes `teile` into the document, the other fields kept; resolves once
   * Firestore confirmed it, or offline after `BESTAETIGUNG_WARTEN_MS`.
   */
  private async schreiben(teile: object): Promise<void> {
    const geschrieben = setDoc(this.dokument, teile, { merge: true });
    // a refusal after the wait rolls the cache back; nobody awaits it then
    geschrieben.catch(() => undefined);
    await Promise.race([geschrieben, this.warten(BESTAETIGUNG_WARTEN_MS)]);
  }
}

function pause(ms: number): Promise<void> {
  return new Promise((weiter) => setTimeout(weiter, ms));
}
