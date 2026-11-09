import { computed, signal, type Signal } from '@angular/core';
import type {
  PersonId,
  TeamId,
  VereinId,
} from '@wolsok/feat-shared-basketball-data';
import type { Vereinsfarben } from '../vereinsfarben/vereinsfarben';
import type { VereinsfarbenWahl } from './vereinsfarben-wahl';
import {
  deleteField,
  doc,
  type DocumentReference,
  type Firestore,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import type { Auswahl } from './auswahl';
import {
  entfolgenAenderung,
  entmarkierenAenderung,
  folgenAenderung,
  gleicheKinder,
  gleicheVereinsfarben,
  grenzenPruefen,
  inhaltAus,
  markierenAenderung,
  spitznameAenderung,
  vereinsfarbenAenderung,
  vereinsfarbenZuruecksetzenAenderung,
  type AuswahlAenderung,
} from './auswahl-aenderungen';
import {
  AUSWAHL_VERSION,
  auswahlDokumentLesen,
  auswahlFelder,
  ENTFERNT,
  naechsterSeit,
  type AuswahlFelder,
  type AuswahlInhalt,
  type GelesenesDokument,
  LEERE_AUSWAHL,
} from './auswahl-dokument';
import { AuswahlZuNeuError } from './auswahl-fehler';
import { gleicheFolge } from '../gleiche-folge';
import type { Kind, MarkierbarerSpieler } from './kind';

/** The collection of the signed-in Elternteile's `AuswahlDokument`s, one per uid. */
export const AUSWAHL_SAMMLUNG = 'auswahl';

/** The document of the Elternteil `uid` in `firestore`. */
export function auswahlDokumentVon(
  firestore: Firestore,
  uid: string
): DocumentReference {
  return doc(firestore, AUSWAHL_SAMMLUNG, uid);
}

/**
 * What a write of `felder` sets, merged (`{ merge: true }`) into the
 * document: the version and each entry by its id, `deleteField()` for one
 * that goes. The server merges it with whatever another device wrote.
 */
export function firestoreFelder(
  felder: AuswahlFelder
): Readonly<Record<string, unknown>> {
  const alsFeld = (wert: unknown): unknown =>
    wert === ENTFERNT
      ? deleteField()
      : typeof wert === 'object' && wert !== null
        ? Object.fromEntries(
            Object.entries(wert).map(([schluessel, innen]) => [
              schluessel,
              alsFeld(innen),
            ])
          )
        : wert;
  return {
    version: AUSWAHL_VERSION,
    ...(felder.teams && { teams: alsFeld(felder.teams) }),
    ...(felder.kinder && { kinder: alsFeld(felder.kinder) }),
    ...(felder.vereinsfarben && {
      vereinsfarben: alsFeld(felder.vereinsfarben),
    }),
  };
}

/** No document yet: an empty one, which a change creates. */
const KEIN_DOKUMENT: GelesenesDokument & { readonly art: 'aktuell' } = {
  art: 'aktuell',
  ...LEERE_AUSWAHL,
  roh: {},
  hoechsterSeit: 0,
};

/** What `FirestoreAuswahl` takes beside its document. */
export interface FirestoreAuswahlOptionen {
  /** Hears of the listener's failure, a refusal of the rules among them. */
  readonly beiFehler?: (fehler: unknown) => void;
}

/**
 * The `Auswahl` of a signed-in Elternteil: their `AuswahlDokument` in
 * Firestore, `auswahl/{uid}`, the same on every device signed in with the
 * account.
 * - It shows what the document holds, as Firestore tells it (other devices'
 *   changes too, until `beenden`), with this device's changes on top until
 *   the server took or refused them; `teams` and `kinder` are `undefined`
 *   until the first answer (`geladen`). Where the listener fails, they are
 *   `undefined` again (what was read may be stale), `nichtLesbar` is set,
 *   `beiFehler` hears of it and every change is refused, as after
 *   `beenden`.
 * - A change writes only the entries it changes, by id (`auswahlFelder`),
 *   merged by the server into the document as it is then: online or
 *   offline (sent once online) alike, so no device's change overwrites
 *   another's, and no network check is needed. It resolves once written to
 *   the device; where the server refuses it (a cap another device filled
 *   meanwhile), Firestore takes it back and the listener shows the
 *   account's.
 * - A document that is none counts as empty; a newer version's is left
 *   alone, every change rejected with `AuswahlZuNeuError`; a change over a
 *   cap, as far as the device knows, is refused with `AuswahlVollError`.
 */
export class FirestoreAuswahl implements Auswahl {
  public readonly teams: Signal<readonly TeamId[] | undefined>;
  public readonly kinder: Signal<readonly Kind[] | undefined>;
  public readonly vereinsfarben: Signal<
    readonly VereinsfarbenWahl[] | undefined
  >;
  public readonly nichtLesbar: Signal<boolean>;
  /** The account's document holds the choices, always this one. */
  public readonly quelle: Signal<unknown> = signal(this).asReadonly();

  /** What the listener told last. */
  private readonly vomListener = signal<GelesenesDokument | undefined>(
    undefined
  );
  /**
   * This device's changes the server has not answered yet, shown on top:
   * every change applies again to a state that holds it already without
   * changing it, so the listener's word wins as soon as it holds them.
   */
  private readonly ausstehend = signal<readonly AuswahlAenderung[]>([]);
  private readonly gelesen = computed((): GelesenesDokument | undefined => {
    const gelesen = this.vomListener();
    if (gelesen === undefined || gelesen.art === 'neuer') {
      return gelesen;
    }
    const aktuell = gelesen.art === 'aktuell' ? gelesen : KEIN_DOKUMENT;
    const { teams, kinder, vereinsfarben } =
      this.ausstehend().reduce<AuswahlInhalt>(
        (stand, aenderung) => aenderung(stand),
        aktuell
      );
    return { ...aktuell, teams, kinder, vereinsfarben };
  });
  private readonly fehlgeschlagen = signal(false);
  /** Why it shows nothing more: its listener failed, or it was ended. */
  private ende?: unknown;
  private readonly ersteLesungAbbrechen: (grund: unknown) => void;
  private readonly dokument: DocumentReference;
  private readonly abbestellen: Unsubscribe;
  private readonly erstesLesen: Promise<void>;
  /** The latest `seit` this adapter gave. */
  private letzterSeit = 0;

  public constructor(
    firestore: Firestore,
    uid: string,
    optionen: FirestoreAuswahlOptionen = {}
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
    this.vereinsfarben = computed(() => inhalt()?.vereinsfarben, {
      equal: (a, b) => a === b || (!!a && !!b && gleicheVereinsfarben(a, b)),
    });
    this.nichtLesbar = this.fehlgeschlagen.asReadonly();
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    this.erstesLesen = promise;
    this.ersteLesungAbbrechen = reject;
    this.abbestellen = onSnapshot(
      this.dokument,
      (stand) => {
        this.vomListener.set(auswahlDokumentLesen(stand.data()));
        resolve();
      },
      (fehler) => {
        // what it read before may be stale now: it shows nothing
        this.ende = fehler;
        this.vomListener.set(undefined);
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
   * Stops listening to the document; a change still waiting for the first
   * read, and every change after, is refused.
   */
  public beenden(): void {
    this.ende ??= new Error('Auswahl: beendet');
    this.ersteLesungAbbrechen(this.ende);
    this.abbestellen();
  }

  /**
   * Applies `aenderung` to what the device shows, once read, and writes the
   * entries it changes; shown at once, until the server answered.
   */
  private aendern(aenderung: AuswahlAenderung): Promise<void> {
    if (this.ende !== undefined) {
      return Promise.reject(this.ende);
    }
    if (this.vomListener() === undefined) {
      return this.erstesLesen.then(() => this.aendern(aenderung));
    }
    try {
      this.schreiben(aenderung);
      return Promise.resolve();
    } catch (fehler) {
      return Promise.reject(fehler);
    }
  }

  private schreiben(aenderung: AuswahlAenderung): void {
    const gelesen = this.gelesen();
    if (gelesen?.art !== 'aktuell') {
      throw new AuswahlZuNeuError();
    }
    const vorher = inhaltAus(gelesen);
    const nachher = aenderung(vorher);
    if (nachher === vorher) {
      return;
    }
    grenzenPruefen(vorher, nachher);
    const seit = naechsterSeit(gelesen, this.letzterSeit);
    const felder = auswahlFelder(vorher, nachher, seit);
    // at most one `seit` per entry
    this.letzterSeit = seit + nachher.teams.length + nachher.kinder.length;
    this.ausstehend.update((alle) => [...alle, aenderung]);
    // answered once online; a refusal takes the change back in the cache
    void setDoc(this.dokument, firestoreFelder(felder), { merge: true })
      .catch(() => undefined)
      .finally(() =>
        this.ausstehend.update((alle) => alle.filter((a) => a !== aenderung))
      );
  }
}
