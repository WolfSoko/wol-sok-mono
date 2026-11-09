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
  grenzenPruefen,
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
 * How long a change waits for Firestore to confirm it, and a read before a
 * change for the server, before going on with what the device holds: a
 * network that seems up but answers nothing would hold them for good.
 */
export const BESTAETIGUNG_WARTEN_MS = 3000;

/** The document of the Elternteil `uid` in `firestore`. */
export function auswahlDokumentVon(
  firestore: Firestore,
  uid: string
): DocumentReference {
  return doc(firestore, AUSWAHL_SAMMLUNG, uid);
}

/** What `FirestoreAuswahl` takes beside its document. */
export interface FirestoreAuswahlOptionen {
  /** Waits `ms` (a timer); replaced in specs. */
  readonly warten?: (ms: number) => Promise<void>;
  /** Whether the device has a network (`navigator.onLine`). */
  readonly istOnline?: () => boolean;
  /** Hears of the listener's failure, a refusal of the rules among them. */
  readonly beiFehler?: (fehler: unknown) => void;
}

/**
 * The `Auswahl` of a signed-in Elternteil: their `AuswahlDokument` in
 * Firestore, `auswahl/{uid}`, the same on every device signed in with the
 * account.
 * - It shows what the document holds, as Firestore tells it (other devices'
 *   changes too, until `beenden`); `teams` and `kinder` are `undefined`
 *   until the first answer (`geladen`). Where the listener fails, they stay
 *   so, `nichtLesbar` is set and `beiFehler` hears of it.
 * - Changes run one after another, each on the document as it is then:
 *   read from the server online, so it keeps what another device changed;
 *   offline (or once the server took `BESTAETIGUNG_WARTEN_MS`) as the
 *   device holds it, its own changes not yet sent included. Each writes
 *   only the list it changes (with the version; both, one of them empty,
 *   into a new document): fields it does not know stay, and the rules
 *   check one list a write.
 * - A change shows at once; it resolves once Firestore confirmed it, or
 *   offline at once and after `BESTAETIGUNG_WARTEN_MS` at most, and is
 *   sent once online.
 * - A document that is none counts as empty; a newer version's is left
 *   alone, every change rejected with `AuswahlZuNeuError`; a change over a
 *   list's cap is refused with `AuswahlVollError`.
 */
export class FirestoreAuswahl implements Auswahl {
  public readonly teams: Signal<readonly TeamId[] | undefined>;
  public readonly kinder: Signal<readonly Kind[] | undefined>;
  public readonly nichtLesbar: Signal<boolean>;

  private readonly gelesen = signal<GelesenesDokument | undefined>(undefined);
  private readonly fehlgeschlagen = signal(false);
  private readonly dokument: DocumentReference;
  private readonly abbestellen: Unsubscribe;
  private readonly erstesLesen: Promise<void>;
  private readonly warten: (ms: number) => Promise<void>;
  private readonly istOnline: () => boolean;
  /** The change running now: the next waits for it. */
  private letzteAenderung: Promise<unknown> = Promise.resolve();

  public constructor(
    firestore: Firestore,
    uid: string,
    optionen: FirestoreAuswahlOptionen = {}
  ) {
    this.warten = optionen.warten ?? pause;
    this.istOnline =
      optionen.istOnline ?? (() => globalThis.navigator?.onLine ?? true);
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
    this.nichtLesbar = this.fehlgeschlagen.asReadonly();
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    this.erstesLesen = promise;
    this.abbestellen = onSnapshot(
      this.dokument,
      (stand) => {
        this.gelesen.set(auswahlDokumentLesen(stand.data()));
        resolve();
      },
      (fehler) => {
        this.fehlgeschlagen.set(true);
        reject(fehler);
        optionen.beiFehler?.(fehler);
      }
    );
    // nobody needs to await the first read; a failure shows as above
    promise.catch(() => undefined);
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

  /** Runs `aenderung` once the change before it is done. */
  private aendern(aenderung: AuswahlAenderung): Promise<void> {
    const lauf = this.letzteAenderung.then(() => this.ausfuehren(aenderung));
    this.letzteAenderung = lauf.catch(() => undefined);
    return lauf;
  }

  /**
   * Applies `aenderung` to the document as it is now and writes the list it
   * changed, if any.
   */
  private async ausfuehren(aenderung: AuswahlAenderung): Promise<void> {
    const gelesen = await this.aktuell();
    if (gelesen.art === 'neuer') {
      this.gelesen.set(gelesen);
      throw new AuswahlZuNeuError();
    }
    const vorher = inhaltAus(gelesen);
    const nachher = aenderung(vorher);
    if (nachher === vorher) {
      return;
    }
    grenzenPruefen(vorher, nachher);
    // a new document gets both lists, as a document without its Teams is none
    const teile = {
      version: AUSWAHL_VERSION,
      ...(gelesen.art === 'aktuell' ? geaendert(vorher, nachher) : nachher),
    };
    const geschrieben = setDoc(this.dokument, teile, { merge: true });
    // a refusal after the wait rolls the cache back; nobody awaits it then
    geschrieben.catch(() => undefined);
    this.gelesen.set({
      art: 'aktuell',
      ...nachher,
      roh: { ...(gelesen.art === 'aktuell' ? gelesen.roh : {}), ...teile },
    });
    if (this.istOnline()) {
      await Promise.race([geschrieben, this.warten(BESTAETIGUNG_WARTEN_MS)]);
    }
  }

  /**
   * The document as it is now: the server's online, else what the device
   * holds (the listener's, this device's changes included).
   */
  private async aktuell(): Promise<GelesenesDokument> {
    if (this.istOnline()) {
      const stand = await Promise.race([
        getDoc(this.dokument).catch(() => undefined),
        this.warten(BESTAETIGUNG_WARTEN_MS).then(() => undefined),
      ]);
      if (stand !== undefined) {
        return auswahlDokumentLesen(stand.data());
      }
    }
    return this.gelesen() ?? { art: 'keins' };
  }
}

function pause(ms: number): Promise<void> {
  return new Promise((weiter) => setTimeout(weiter, ms));
}
