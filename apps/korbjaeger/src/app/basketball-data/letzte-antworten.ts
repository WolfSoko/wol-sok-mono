/** The last good answer of the proxy at one path, and when it came. */
export interface LetzteAntwort {
  /** The DBB's JSON as the proxy answered it with 200. */
  readonly antwort: unknown;
  /** When it came, in ms since the epoch. */
  readonly gespeichertAm: number;
}

/**
 * The last good answer per proxy path, for a read that fails later
 * (offline, or the DBB down). Only successes go in; never an error.
 */
export interface LetzteAntworten {
  lesen(pfad: string): LetzteAntwort | undefined;
  merken(pfad: string, antwort: LetzteAntwort): void;
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

/** The prefix of every key the store writes; it touches no other key. */
export const ANTWORT_PRAEFIX = 'korbjaeger-antwort:';

const VERSION = 1;

interface Eintrag {
  readonly schluessel: string;
  readonly text: string;
  readonly zeichen: number;
}

/**
 * `LetzteAntworten` in the device's `localStorage`, one key per path
 * (`korbjaeger-antwort:/api/dbb/...`), as `{ v: 1, am, antwort }`. The
 * answers are the DBB's public data, nothing of the user.
 * - Capped by `grenzen`: a write that would exceed them evicts the oldest
 *   answers first (by when they were stored; one that cannot be read
 *   before all others), and one larger than all may be is not kept.
 * - A full storage (`QuotaExceededError`) evicts the oldest answers until
 *   the write fits, or gives up once none is left; keys of others (Meine
 *   Teams) are never touched.
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

  public lesen(pfad: string): LetzteAntwort | undefined {
    try {
      return gelesen(this.speicher?.getItem(schluesselVon(pfad)));
    } catch {
      return undefined;
    }
  }

  public merken(pfad: string, { antwort, gespeichertAm }: LetzteAntwort): void {
    const schluessel = schluesselVon(pfad);
    const text = JSON.stringify({ v: VERSION, am: gespeichertAm, antwort });
    const zeichen = schluessel.length + text.length;
    if (this.speicher === undefined || zeichen > this.grenzen.zeichen) {
      return;
    }
    try {
      const andere = this.eintraegeAusser(schluessel);
      const bleiben = this.innerhalbDerGrenzen(andere, zeichen);
      this.schreiben(schluessel, text, bleiben);
    } catch {
      // storage blocked: the answer is not kept
    }
  }

  /**
   * What stays of `andere` beside a new answer of `zeichen`, oldest first
   * once it had to look at their age; evicts the oldest beyond the limits.
   */
  private innerhalbDerGrenzen(
    andere: readonly Eintrag[],
    zeichen: number
  ): readonly Eintrag[] {
    const passt = (eintraege: readonly Eintrag[]): boolean =>
      eintraege.length + 1 <= this.grenzen.eintraege &&
      summe(eintraege) + zeichen <= this.grenzen.zeichen;
    if (passt(andere)) {
      // the common case: no stored answer needs to be parsed for its age
      return andere;
    }
    const bleiben = nachAlter(andere);
    while (bleiben.length > 0 && !passt(bleiben)) {
      this.entfernen(bleiben.shift());
    }
    return bleiben;
  }

  /** Writes `text`, evicting the oldest of `andere` while the storage is full. */
  private schreiben(
    schluessel: string,
    text: string,
    andere: readonly Eintrag[]
  ): void {
    let aelteste: Eintrag[] | undefined;
    for (;;) {
      try {
        this.speicher?.setItem(schluessel, text);
        return;
      } catch (error) {
        aelteste ??= nachAlter(andere);
        if (!istSpeicherVoll(error) || aelteste.length === 0) {
          return;
        }
        this.entfernen(aelteste.shift());
      }
    }
  }

  private entfernen(eintrag: Eintrag | undefined): void {
    if (eintrag !== undefined) {
      this.speicher?.removeItem(eintrag.schluessel);
    }
  }

  /** The store's entries other than `schluessel`. */
  private eintraegeAusser(schluessel: string): Eintrag[] {
    const speicher = this.speicher;
    if (speicher === undefined) {
      return [];
    }
    return Array.from({ length: speicher.length }, (_, index) =>
      speicher.key(index)
    )
      .filter(
        (key): key is string =>
          key !== null && key !== schluessel && key.startsWith(ANTWORT_PRAEFIX)
      )
      .map((key) => {
        const text = speicher.getItem(key) ?? '';
        return { schluessel: key, text, zeichen: key.length + text.length };
      });
  }
}

function schluesselVon(pfad: string): string {
  return `${ANTWORT_PRAEFIX}${pfad}`;
}

/**
 * `eintraege`, oldest first by when they were stored; one that cannot be
 * read before all others.
 */
function nachAlter(eintraege: readonly Eintrag[]): Eintrag[] {
  const alter = (eintrag: Eintrag): number =>
    gelesen(eintrag.text)?.gespeichertAm ?? Number.NEGATIVE_INFINITY;
  return eintraege
    .map((eintrag) => ({ eintrag, am: alter(eintrag) }))
    .sort((a, b) => a.am - b.am)
    .map(({ eintrag }) => eintrag);
}

/** A stored answer of this version, or `undefined` for anything else. */
function gelesen(text: string | null | undefined): LetzteAntwort | undefined {
  if (!text) {
    return undefined;
  }
  try {
    const gespeichert: unknown = JSON.parse(text);
    return istGespeichert(gespeichert)
      ? { antwort: gespeichert.antwort, gespeichertAm: gespeichert.am }
      : undefined;
  } catch {
    return undefined;
  }
}

function istGespeichert(
  value: unknown
): value is { v: typeof VERSION; am: number; antwort: unknown } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'v' in value &&
    value.v === VERSION &&
    'am' in value &&
    typeof value.am === 'number' &&
    'antwort' in value
  );
}

function summe(eintraege: readonly Eintrag[]): number {
  return eintraege.reduce((sum, { zeichen }) => sum + zeichen, 0);
}

/** Whether `error` says the storage is full (Firefox names it its own way). */
function istSpeicherVoll(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  );
}
