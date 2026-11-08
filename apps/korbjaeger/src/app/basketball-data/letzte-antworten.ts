import type { DbbRequestKind } from '@wolsok/feat-shared-basketball-data';

/** The last good answer of the proxy at one path, and when it came. */
export interface LetzteAntwort {
  /** The DBB's JSON as the proxy answered it with 200. */
  readonly antwort: unknown;
  /** When it came, in ms since the epoch. */
  readonly gespeichertAm: number;
}

/**
 * The last good answer per proxy path, for a read that fails later
 * (offline, or the DBB down). Only answers the adapter could read go in;
 * never an error.
 */
export interface LetzteAntworten {
  /** The answer at `pfad`, unless none is kept or it is too old at `jetzt`. */
  lesen(pfad: string, jetzt: number): LetzteAntwort | undefined;
  merken(pfad: string, art: DbbRequestKind, antwort: LetzteAntwort): void;
}

/** The part of `localStorage` the store uses. */
export type AntwortSpeicher = Pick<
  Storage,
  'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'
>;

/** How much the store may keep at most. */
export interface AntwortGrenzen {
  /** Answers, one per path. */
  readonly eintraege: number;
  /** Characters of all stored answers together, keys included. */
  readonly zeichen: number;
}

/**
 * Enough for the Team page and the overview of a handful of followed Teams
 * (each about five reads), and at most about 2 MB of the origin's 5 MB:
 * Meine Teams share the storage and must always find room.
 */
export const ANTWORT_GRENZEN: AntwortGrenzen = {
  eintraege: 60,
  zeichen: 1_000_000,
};

/**
 * How old an answer may be served: a week, about a Spieltag's rhythm.
 * Older is neither shown nor kept (ADR 0019: keep as little as serves).
 */
export const MAX_ALTER_MS = 7 * 24 * 60 * 60_000;

/** The prefix of every answer's key; the store touches no other key but its index. */
export const ANTWORT_PRAEFIX = 'korbjaeger-antwort:';

/** The key of the index: per answer its size, time and kind. */
export const ANTWORT_INDEX = 'korbjaeger-antworten';

const VERSION = 2;
const INDEX_VERSION = 1;

/** What the index knows of one stored answer, by its key. */
interface IndexEintrag {
  readonly zeichen: number;
  /** When it was stored; `-Infinity` for one that cannot be read. */
  readonly am: number;
  /** Its kind of read; `''` for one that cannot be read. */
  readonly art: string;
}

type Index = Map<string, IndexEintrag>;

interface Gespeichert {
  readonly v: typeof VERSION;
  readonly am: number;
  readonly art: string;
  readonly antwort: unknown;
}

/**
 * `LetzteAntworten` in the device's `localStorage`, one key per path
 * (`korbjaeger-antwort:/api/dbb/...`, as `{ v: 2, am, art, antwort }`),
 * with an index (`korbjaeger-antworten`) of each answer's size, time and
 * kind, so a write reads no answer. The transport decides which reads go
 * in (`SPEICHERBARE_ARTEN`: a Team's Spiele, a Tabelle, a Spiel's match
 * info, a Verein's Spiele), each without the persons it names
 * (`dbbOhnePersonen`); never a Spielbericht with its Kader, never the
 * Liga search (ADR 0019). Nothing of the user.
 * - An answer older than `MAX_ALTER_MS` is not served and is deleted;
 *   `aufraeumen`, at the app's start, deletes those and answers of kinds
 *   no longer kept.
 * - Capped by `grenzen`: a write beyond them evicts the oldest answers
 *   first (one that cannot be read before all others); an answer larger
 *   than all may be is not kept, and neither is the older one of its path.
 * - A full storage (`QuotaExceededError`) evicts the oldest answers until
 *   the write fits; if none is left, the path keeps no answer. Keys of
 *   others (Meine Teams) are never touched.
 * - The index follows the answers: one deleted behind its back is
 *   forgotten, one it does not know is read once, and an index that
 *   cannot be read is rebuilt from the answers.
 * - A storage that is blocked or throws keeps nothing and fails nothing.
 */
export class LokaleLetzteAntworten implements LetzteAntworten {
  private readonly grenzen: AntwortGrenzen;

  public constructor(
    private readonly speicher: AntwortSpeicher | undefined,
    grenzen: Partial<AntwortGrenzen> = {}
  ) {
    this.grenzen = { ...ANTWORT_GRENZEN, ...grenzen };
  }

  public lesen(pfad: string, jetzt: number): LetzteAntwort | undefined {
    try {
      const schluessel = schluesselVon(pfad);
      const gespeichert = gelesen(this.speicher?.getItem(schluessel));
      if (gespeichert === undefined) {
        return undefined;
      }
      if (zuAlt(gespeichert.am, jetzt)) {
        // the index forgets it on its next pass
        this.speicher?.removeItem(schluessel);
        return undefined;
      }
      return { antwort: gespeichert.antwort, gespeichertAm: gespeichert.am };
    } catch {
      return undefined;
    }
  }

  public merken(
    pfad: string,
    art: DbbRequestKind,
    { antwort, gespeichertAm }: LetzteAntwort
  ): void {
    const schluessel = schluesselVon(pfad);
    const text = JSON.stringify({
      v: VERSION,
      am: gespeichertAm,
      art,
      antwort,
    } satisfies Gespeichert);
    const eintrag = {
      zeichen: schluessel.length + text.length,
      am: gespeichertAm,
      art,
    };
    try {
      const index = this.index();
      index.delete(schluessel);
      const geschrieben =
        eintrag.zeichen <= this.grenzen.zeichen &&
        this.innerhalbDerGrenzen(index, eintrag.zeichen) &&
        this.schreiben(schluessel, text, index);
      if (geschrieben) {
        index.set(schluessel, eintrag);
      } else {
        // never serve an answer older than the last good one
        this.speicher?.removeItem(schluessel);
      }
      this.indexSchreiben(index);
    } catch {
      // storage blocked: the answer is not kept
    }
  }

  /**
   * Deletes the answers too old at `jetzt`, and those whose kind is none of
   * `arten` (or that cannot be read).
   */
  public aufraeumen(jetzt: number, arten: ReadonlySet<string>): void {
    try {
      const index = this.index();
      for (const [schluessel, { am, art }] of index) {
        if (zuAlt(am, jetzt) || !arten.has(art)) {
          this.speicher?.removeItem(schluessel);
          index.delete(schluessel);
        }
      }
      this.indexSchreiben(index);
    } catch {
      // storage blocked: nothing to clear
    }
  }

  /**
   * Evicts the oldest of `index` until a new answer of `zeichen` fits the
   * limits beside them; whether it does.
   */
  private innerhalbDerGrenzen(index: Index, zeichen: number): boolean {
    const passt = (): boolean =>
      index.size + 1 <= this.grenzen.eintraege &&
      summe(index) + zeichen <= this.grenzen.zeichen;
    for (const schluessel of nachAlter(index)) {
      if (passt()) {
        break;
      }
      this.entfernen(schluessel, index);
    }
    return passt();
  }

  /**
   * Writes `text`, evicting the oldest of `index` while the storage is
   * full; whether it was written.
   */
  private schreiben(schluessel: string, text: string, index: Index): boolean {
    const aelteste = nachAlter(index);
    for (;;) {
      try {
        this.speicher?.setItem(schluessel, text);
        return true;
      } catch (error) {
        const aeltester = aelteste.shift();
        if (!istSpeicherVoll(error) || aeltester === undefined) {
          return false;
        }
        this.entfernen(aeltester, index);
      }
    }
  }

  private entfernen(schluessel: string, index: Index): void {
    this.speicher?.removeItem(schluessel);
    index.delete(schluessel);
  }

  /**
   * The index as the stored answers stand: its entries for keys still
   * there, and each answer it does not know (all, where it cannot be read)
   * read once.
   */
  private index(): Index {
    const speicher = this.speicher;
    if (speicher === undefined) {
      return new Map();
    }
    const bekannt = indexGelesen(speicher.getItem(ANTWORT_INDEX));
    const index: Index = new Map();
    for (const schluessel of antwortSchluessel(speicher)) {
      index.set(
        schluessel,
        bekannt.get(schluessel) ??
          eintragVon(schluessel, speicher.getItem(schluessel) ?? '')
      );
    }
    return index;
  }

  private indexSchreiben(index: Index): void {
    try {
      this.speicher?.setItem(
        ANTWORT_INDEX,
        JSON.stringify({
          v: INDEX_VERSION,
          eintraege: Object.fromEntries(index),
        })
      );
    } catch {
      // not kept: the next pass rebuilds it from the answers
    }
  }
}

function schluesselVon(pfad: string): string {
  return `${ANTWORT_PRAEFIX}${pfad}`;
}

function zuAlt(am: number, jetzt: number): boolean {
  return jetzt - am > MAX_ALTER_MS;
}

/** Every answer's key in `speicher`; reads no value. */
function antwortSchluessel(speicher: AntwortSpeicher): string[] {
  return Array.from({ length: speicher.length }, (_, i) =>
    speicher.key(i)
  ).filter(
    (key): key is string => key !== null && key.startsWith(ANTWORT_PRAEFIX)
  );
}

/** What the index says of the answers; nothing where it cannot be read. */
function indexGelesen(text: string | null): Index {
  try {
    const index: unknown = text ? JSON.parse(text) : undefined;
    if (
      typeof index !== 'object' ||
      index === null ||
      !('v' in index) ||
      index.v !== INDEX_VERSION ||
      !('eintraege' in index) ||
      typeof index.eintraege !== 'object' ||
      index.eintraege === null
    ) {
      return new Map();
    }
    return new Map(
      Object.entries(index.eintraege).filter(
        (paar): paar is [string, IndexEintrag] => istIndexEintrag(paar[1])
      )
    );
  } catch {
    return new Map();
  }
}

function istIndexEintrag(value: unknown): value is IndexEintrag {
  return (
    typeof value === 'object' &&
    value !== null &&
    'zeichen' in value &&
    typeof value.zeichen === 'number' &&
    'am' in value &&
    typeof value.am === 'number' &&
    'art' in value &&
    typeof value.art === 'string'
  );
}

function eintragVon(schluessel: string, text: string): IndexEintrag {
  const gespeichert = gelesen(text);
  return {
    zeichen: schluessel.length + text.length,
    am: gespeichert?.am ?? Number.NEGATIVE_INFINITY,
    art: gespeichert?.art ?? '',
  };
}

/** The keys of `index`, oldest first by when they were stored. */
function nachAlter(index: Index): string[] {
  return [...index]
    .sort(([, a], [, b]) => a.am - b.am)
    .map(([schluessel]) => schluessel);
}

/** A stored answer of this version, or `undefined` for anything else. */
function gelesen(text: string | null | undefined): Gespeichert | undefined {
  if (!text) {
    return undefined;
  }
  try {
    const gespeichert: unknown = JSON.parse(text);
    return istGespeichert(gespeichert) ? gespeichert : undefined;
  } catch {
    return undefined;
  }
}

function istGespeichert(value: unknown): value is Gespeichert {
  return (
    typeof value === 'object' &&
    value !== null &&
    'v' in value &&
    value.v === VERSION &&
    'am' in value &&
    typeof value.am === 'number' &&
    'art' in value &&
    typeof value.art === 'string' &&
    'antwort' in value
  );
}

function summe(index: Index): number {
  let zeichen = 0;
  for (const eintrag of index.values()) {
    zeichen += eintrag.zeichen;
  }
  return zeichen;
}

/** Whether `error` says the storage is full (Firefox names it its own way). */
function istSpeicherVoll(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  );
}
