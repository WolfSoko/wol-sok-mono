import { computed, signal, type Signal } from '@angular/core';
import type { PersonId, TeamId } from '@wolsok/feat-shared-basketball-data';
import {
  arrayRemove,
  arrayUnion,
  doc,
  type DocumentReference,
  type Firestore,
  onSnapshot,
  runTransaction,
  type Unsubscribe,
  writeBatch,
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
  type AuswahlInhalt,
  type GelesenesDokument,
} from './auswahl-dokument';
import {
  AuswahlOfflineUnbekanntError,
  AuswahlZuNeuError,
} from './auswahl-fehler';
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

/** What `FirestoreAuswahl` takes beside its document. */
export interface FirestoreAuswahlOptionen {
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
 * - Changes run one after another. Online each runs in a transaction on
 *   the server's document, which Firestore runs again where another device
 *   changed it meanwhile, so no change is lost; it shows at once and is
 *   taken back where it fails. Offline each is checked on the document as
 *   the device holds it (its own changes not yet sent included), shows at
 *   once and is sent once online as what it adds to and takes from each
 *   list (`arrayUnion`, `arrayRemove`), so the server merges it with what
 *   other devices changed meanwhile; a Spitzname changed takes the old Kind
 *   out and adds the new one at the end. Where the merge goes over a cap,
 *   the rules refuse the write and the device's cache drops it. Where the
 *   device never knew the document, a change is refused
 *   (`AuswahlOfflineUnbekanntError`), as it could overwrite the account's.
 * - A change writes only the list it changes (with the version; both, one
 *   of them empty, into a new document): fields it does not know stay, and
 *   the rules check one list a write.
 * - A document that is none counts as empty; a newer version's is left
 *   alone, every change rejected with `AuswahlZuNeuError`; a change over a
 *   list's cap is refused with `AuswahlVollError`.
 */
export class FirestoreAuswahl implements Auswahl {
  public readonly teams: Signal<readonly TeamId[] | undefined>;
  public readonly kinder: Signal<readonly Kind[] | undefined>;
  public readonly nichtLesbar: Signal<boolean>;

  /** What the listener told last. */
  private readonly vomListener = signal<GelesenesDokument | undefined>(
    undefined
  );
  /** The changes run, until the listener tells of them. */
  private readonly ausgefuehrt = signal<GelesenesDokument | undefined>(
    undefined
  );
  /** The changes waiting to run too, shown ahead of them. */
  private readonly vorschau = signal<GelesenesDokument | undefined>(undefined);
  /** What the changes run so far make of the document, the device's best word. */
  private readonly stand = computed(
    () => this.ausgefuehrt() ?? this.vomListener()
  );
  private readonly gelesen = computed(() => this.vorschau() ?? this.stand());
  private readonly fehlgeschlagen = signal(false);
  /** Whether the device knows the document: from the server, or as cached. */
  private bekannt = false;
  /** How many changes run now: the listener's word replaces a preview only without. */
  private laufend = 0;
  private readonly dokument: DocumentReference;
  private readonly abbestellen: Unsubscribe;
  private readonly erstesLesen: Promise<void>;
  private readonly istOnline: () => boolean;
  /** The change running now: the next waits for it. */
  private letzteAenderung: Promise<unknown> = Promise.resolve();

  public constructor(
    private readonly firestore: Firestore,
    uid: string,
    optionen: FirestoreAuswahlOptionen = {}
  ) {
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
        this.bekannt ||= stand.exists() || !stand.metadata.fromCache;
        this.vomListener.set(auswahlDokumentLesen(stand.data()));
        if (this.laufend === 0) {
          this.ausgefuehrt.set(undefined);
        }
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

  /** Shows `aenderung` at once, and runs it once the change before it is done. */
  private aendern(aenderung: AuswahlAenderung): Promise<void> {
    this.laufend++;
    const angezeigt = this.gelesen();
    if (angezeigt?.art === 'aktuell' && this.bekannt) {
      this.vorschauen(angezeigt, aenderung);
    }
    const lauf = this.letzteAenderung
      .then(() => this.ausfuehren(aenderung))
      .finally(() => {
        if (--this.laufend === 0) {
          this.vorschau.set(undefined);
        }
      });
    this.letzteAenderung = lauf.catch(() => undefined);
    return lauf;
  }

  /**
   * Applies `aenderung` to the document as it is now and writes the list it
   * changed, if any: online in a transaction (Firestore runs it again on
   * a conflict, so a change elsewhere is never lost), offline on what the
   * device holds.
   */
  private ausfuehren(aenderung: AuswahlAenderung): Promise<void> {
    return this.istOnline()
      ? this.imTransaktion(aenderung)
      : this.aufDemGeraet(aenderung);
  }

  private async imTransaktion(aenderung: AuswahlAenderung): Promise<void> {
    try {
      const geschrieben = await runTransaction(
        this.firestore,
        async (transaktion) => {
          const gelesen = auswahlDokumentLesen(
            (await transaktion.get(this.dokument)).data()
          );
          const schritt = schrittFuer(gelesen, aenderung);
          if (schritt !== undefined) {
            transaktion.set(this.dokument, schritt.teile, { merge: true });
          }
          return schritt === undefined ? undefined : { gelesen, schritt };
        }
      );
      if (geschrieben) {
        this.ausgefuehrt.set(
          nachDemSchritt(geschrieben.gelesen, geschrieben.schritt)
        );
      }
    } catch (fehler) {
      // the preview is taken back; a newer version's document shows nothing
      this.vorschau.set(undefined);
      if (fehler instanceof AuswahlZuNeuError) {
        this.ausgefuehrt.set({ art: 'neuer' });
      }
      throw fehler;
    }
  }

  /**
   * Offline: on the document as the device holds it (its own changes not
   * yet sent included), sent once online. Refused where the device never
   * knew the document, as a write then could overwrite the account's.
   */
  private async aufDemGeraet(aenderung: AuswahlAenderung): Promise<void> {
    const gelesen = this.stand();
    if (gelesen === undefined || !this.bekannt) {
      this.vorschau.set(undefined);
      throw new AuswahlOfflineUnbekanntError();
    }
    let schritt: Schritt | undefined;
    try {
      schritt = schrittFuer(gelesen, aenderung);
    } catch (fehler) {
      this.vorschau.set(undefined);
      throw fehler;
    }
    if (schritt === undefined) {
      return;
    }
    const stapel = writeBatch(this.firestore);
    for (const teile of feldAenderungen(gelesen, schritt.nachher)) {
      stapel.set(this.dokument, teile, { merge: true });
    }
    // sent once online; a refusal then rolls the cache back
    stapel.commit().catch(() => undefined);
    this.ausgefuehrt.set(nachDemSchritt(gelesen, schritt));
  }

  /** Shows what `aenderung` makes of `angezeigt`, where it is within the caps. */
  private vorschauen(
    angezeigt: GelesenesDokument,
    aenderung: AuswahlAenderung
  ): void {
    try {
      const schritt = schrittFuer(angezeigt, aenderung);
      if (schritt !== undefined) {
        this.vorschau.set(nachDemSchritt(angezeigt, schritt));
      }
    } catch {
      // the transaction refuses it again, with the same error
    }
  }
}

/** What a change writes, and what the selection holds once it did. */
interface Schritt {
  readonly teile: Readonly<Record<string, unknown>>;
  readonly nachher: AuswahlInhalt;
}

/**
 * What `aenderung` writes to `gelesen`: only the list it changes (with the
 * version; both, one of them empty, into a new document); nothing where it
 * changes nothing. Throws where `gelesen` is a newer version's or the
 * change goes over a cap.
 */
function schrittFuer(
  gelesen: GelesenesDokument,
  aenderung: AuswahlAenderung
): Schritt | undefined {
  if (gelesen.art === 'neuer') {
    throw new AuswahlZuNeuError();
  }
  const vorher = inhaltAus(gelesen);
  const nachher = aenderung(vorher);
  if (nachher === vorher) {
    return undefined;
  }
  grenzenPruefen(vorher, nachher);
  // a new document gets both lists, as one without its Teams has none
  const teile = {
    version: AUSWAHL_VERSION,
    ...(gelesen.art === 'aktuell' ? geaendert(vorher, nachher) : nachher),
  };
  return { teile, nachher };
}

/** `gelesen` once `schritt` is written. */
function nachDemSchritt(
  gelesen: GelesenesDokument,
  schritt: Schritt
): GelesenesDokument {
  return {
    art: 'aktuell',
    ...schritt.nachher,
    roh: {
      ...(gelesen.art === 'aktuell' ? gelesen.roh : {}),
      ...schritt.teile,
    },
  };
}

/**
 * The writes that take `gelesen` to `nachher` as transforms the server
 * applies to the document as it then is: first what leaves each list, then
 * what joins it (a field takes one transform a write). The Kinder leaving
 * are every stored entry not wanted as it is, duplicates of a person the
 * reader skipped included.
 */
function feldAenderungen(
  gelesen: GelesenesDokument,
  nachher: AuswahlInhalt
): readonly Readonly<Record<string, unknown>>[] {
  const vorher = inhaltAus(gelesen);
  const gespeicherteKinder = listeAus(
    gelesen.art === 'aktuell' ? gelesen.roh['kinder'] : undefined
  );
  const neu = gelesen.art !== 'aktuell';
  const raus = {
    teams: vorher.teams.filter((team) => !nachher.teams.includes(team)),
    kinder: gespeicherteKinder.filter(
      (eintrag) => !nachher.kinder.some((kind) => istEintragVon(eintrag, kind))
    ),
  };
  const rein = {
    teams: nachher.teams.filter((team) => !vorher.teams.includes(team)),
    kinder: nachher.kinder.filter(
      (kind) =>
        !gespeicherteKinder.some((eintrag) => istEintragVon(eintrag, kind))
    ),
  };
  return [
    transformiert(raus, arrayRemove, false),
    // a new document gets both lists, as one without its Teams has none
    transformiert(rein, arrayUnion, neu),
  ].filter((teile) => teile !== undefined);
}

/** One write of `listen` through `transform`, or none where it changes none. */
function transformiert(
  listen: {
    readonly teams: readonly unknown[];
    readonly kinder: readonly unknown[];
  },
  transform: typeof arrayUnion,
  jedeListe: boolean
): Readonly<Record<string, unknown>> | undefined {
  const teile = Object.fromEntries(
    Object.entries(listen)
      .filter(([, eintraege]) => jedeListe || eintraege.length > 0)
      .map(([liste, eintraege]) => [liste, transform(...eintraege)])
  );
  return Object.keys(teile).length === 0
    ? undefined
    : { version: AUSWAHL_VERSION, ...teile };
}

function listeAus(gespeichert: unknown): readonly unknown[] {
  return Array.isArray(gespeichert) ? gespeichert : [];
}

/**
 * Whether the stored `eintrag` is `kind` as Firestore compares them: the
 * same fields with the same values.
 */
function istEintragVon(eintrag: unknown, kind: Kind): boolean {
  if (typeof eintrag !== 'object' || eintrag === null) {
    return false;
  }
  const felder = eintrag as Readonly<Record<string, unknown>>;
  return (
    Object.keys(felder).length === Object.keys(kind).length &&
    felder['personId'] === kind.personId &&
    felder['spitzname'] === kind.spitzname
  );
}
