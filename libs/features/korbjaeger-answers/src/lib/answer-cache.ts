import type { DbbRequestKind } from '@wolsok/feat-shared-basketball-data';
import { isStorageFull } from '@wolsok/utils-browser-storage';

/** The last good answer of the proxy at one path, and when it came. */
export interface CachedAnswer {
  /** The DBB's JSON as the proxy answered it with 200. */
  readonly answer: unknown;
  /** When it came, in ms since the epoch. */
  readonly storedAt: number;
}

/**
 * The last good answer per proxy path, for a read that fails later
 * (offline, or the DBB down). Only answers the adapter could read go in;
 * never an error.
 */
export interface AnswerCache {
  /** The answer at `path`, unless none is kept or it is too old at `now`. */
  read(path: string, now: number): CachedAnswer | undefined;
  store(path: string, kind: DbbRequestKind, answer: CachedAnswer): void;
}

/** The part of `localStorage` the store uses. */
export type AnswerStorage = Pick<
  Storage,
  'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'
>;

/** How much the store may keep at most. */
export interface AnswerLimits {
  /** Answers, one per path. */
  readonly entries: number;
  /** Characters of all stored answers together, keys included. */
  readonly characters: number;
}

/**
 * Enough for the Team page and the overview of a handful of followed Teams
 * (each about five reads), and at most about 2 MB of the origin's 5 MB:
 * Meine Teams share the storage and must always find room.
 */
export const ANSWER_LIMITS: AnswerLimits = {
  entries: 60,
  characters: 1_000_000,
};

/**
 * How old an answer may be served: a week, about a Spieltag's rhythm.
 * Older is neither shown nor kept (ADR 0019: keep as little as serves).
 */
export const MAX_AGE_DAYS = 7;

/** `MAX_AGE_DAYS` in milliseconds, as the store compares ages. */
export const MAX_AGE_MS = MAX_AGE_DAYS * 24 * 60 * 60_000;

/** The prefix of every answer's key; the store touches no other key but its index. */
export const ANSWER_PREFIX = 'korbjaeger-answer:';

/** The key of the index: per answer its size, time and kind. */
export const ANSWER_INDEX = 'korbjaeger-answers';

const VERSION = 2;
const INDEX_VERSION = 1;

/**
 * The string each kind of read is stored as (`art`): the kinds' names
 * before #2967, so the answers stored before the rename stay valid and
 * no read goes to the DBB again for them.
 */
const STORED_KINDS: Readonly<Record<DbbRequestKind, string>> = {
  'league-search': 'liga-suche',
  'league-page': 'liga-seite',
  standings: 'tabelle',
  schedule: 'spielplan',
  'team-games': 'team-spiele',
  'club-games': 'vereins-spiele',
  'game-info': 'spiel-info',
  'game-report': 'spielbericht',
};

/** What the index knows of one stored answer, by its key. */
interface IndexEntry {
  readonly zeichen: number;
  /** When it was stored; `-Infinity` for one that cannot be read. */
  readonly am: number;
  /** Its kind of read; `''` for one that cannot be read. */
  readonly art: string;
}

type Index = Map<string, IndexEntry>;

interface StoredAnswer {
  readonly v: typeof VERSION;
  readonly am: number;
  readonly art: string;
  readonly antwort: unknown;
}

/**
 * `AnswerCache` in the device's `localStorage`, one key per path
 * (`korbjaeger-answer:/api/dbb/...`, as `{ v: 2, am, art, antwort }`),
 * with an index (`korbjaeger-answers`) of each answer's size, time and
 * kind, so a write reads no answer. The transport decides which reads go
 * in (`SPEICHERBARE_ARTEN`: a Team's Spiele, a Tabelle, a Spiel's match
 * info, a Verein's Spiele), each without the persons it names
 * (`dbbWithoutPersons`); never a Spielbericht with its Kader, never the
 * Liga search (ADR 0019). Nothing of the user.
 * - An answer older than `MAX_AGE_MS` is not served and is deleted;
 *   `cleanUp`, at the app's start, deletes those and answers of kinds
 *   no longer kept.
 * - Capped by `limits`: a write beyond them evicts the oldest answers
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
export class LocalAnswerCache implements AnswerCache {
  private readonly limits: AnswerLimits;
  /** The index as this store last read or wrote it; read on first need. */
  private known: Index | undefined;
  /** The stored index's text then, to notice another tab's changes. */
  private knownText: string | null = null;

  public constructor(
    private readonly storage: AnswerStorage | undefined,
    limits: Partial<AnswerLimits> = {}
  ) {
    this.limits = { ...ANSWER_LIMITS, ...limits };
  }

  public read(path: string, now: number): CachedAnswer | undefined {
    try {
      const key = keyOf(path);
      const stored = parsedAnswer(this.storage?.getItem(key));
      if (stored === undefined) {
        return undefined;
      }
      if (tooOld(stored.am, now)) {
        // the stored index forgets it on the next write
        this.storage?.removeItem(key);
        this.known?.delete(key);
        return undefined;
      }
      return { answer: stored.antwort, storedAt: stored.am };
    } catch {
      return undefined;
    }
  }

  public store(
    path: string,
    kind: DbbRequestKind,
    { answer, storedAt }: CachedAnswer
  ): void {
    const key = keyOf(path);
    const storedKind = STORED_KINDS[kind];
    const text = JSON.stringify({
      v: VERSION,
      am: storedAt,
      art: storedKind,
      antwort: answer,
    } satisfies StoredAnswer);
    const entry = {
      zeichen: key.length + text.length,
      am: storedAt,
      art: storedKind,
    };
    try {
      const index = this.index();
      index.delete(key);
      const oldest = new Oldest(index);
      // write first: a write the storage refuses evicts nothing
      if (
        entry.zeichen <= this.limits.characters &&
        this.write(key, text, index, oldest)
      ) {
        this.keepWithinLimits(index, oldest, entry.zeichen);
        index.set(key, entry);
      } else {
        // never serve an answer older than the last good one
        this.storage?.removeItem(key);
      }
      this.writeIndex(index);
    } catch {
      // storage blocked: the answer is not kept
    }
  }

  /** Deletes every answer: for what must not give way (Meine Teams). */
  public clear(): void {
    try {
      const index = this.index();
      for (const key of index.keys()) {
        this.remove(key, index);
      }
      this.storage?.removeItem(ANSWER_INDEX);
      this.known = undefined;
      this.knownText = null;
    } catch {
      // storage blocked: nothing to free
    }
  }

  /**
   * Deletes the answers too old at `now`, and those whose kind is none of
   * `kinds` (or that cannot be read).
   */
  public cleanUp(now: number, kinds: ReadonlySet<DbbRequestKind>): void {
    const storedKinds = new Set([...kinds].map((k) => STORED_KINDS[k]));
    try {
      const index = this.index();
      for (const [key, { am, art: kind }] of index) {
        if (tooOld(am, now) || !storedKinds.has(kind)) {
          this.remove(key, index);
        }
      }
      this.writeIndex(index);
    } catch {
      // storage blocked: nothing to clear
    }
  }

  /**
   * Evicts the oldest of `index` until a new answer of `characters`, stored
   * beside them, keeps the limits.
   */
  private keepWithinLimits(
    index: Index,
    oldest: Oldest,
    characters: number
  ): void {
    let used = totalCharacters(index) + characters;
    while (
      index.size + 1 > this.limits.entries ||
      used > this.limits.characters
    ) {
      const oldestKey = oldest.next();
      if (oldestKey === undefined) {
        return;
      }
      used -= index.get(oldestKey)?.zeichen ?? 0;
      this.remove(oldestKey, index);
    }
  }

  /**
   * Writes `text`, evicting the oldest of `index` while the storage is
   * full; whether it was written.
   */
  private write(
    key: string,
    text: string,
    index: Index,
    oldest: Oldest
  ): boolean {
    for (;;) {
      try {
        this.storage?.setItem(key, text);
        return true;
      } catch (error) {
        const oldestKey = oldest.next();
        if (!isStorageFull(error) || oldestKey === undefined) {
          return false;
        }
        this.remove(oldestKey, index);
      }
    }
  }

  private remove(key: string, index: Index): void {
    this.storage?.removeItem(key);
    index.delete(key);
  }

  /**
   * The index as the stored answers stand. The one this store knows, while
   * the stored index is the one it last saw and names the answers there
   * are; else read again: its entries for keys still there, and each answer
   * it does not know (all, where it cannot be read) read once.
   */
  private index(): Index {
    const storage = this.storage;
    if (storage === undefined) {
      return new Map();
    }
    const text = storage.getItem(ANSWER_INDEX);
    const keys = answerKeys(storage);
    if (
      this.known !== undefined &&
      text === this.knownText &&
      sameKeys(this.known, keys)
    ) {
      return this.known;
    }
    const stored =
      this.known !== undefined && text === this.knownText
        ? this.known
        : readIndex(text);
    const index: Index = new Map();
    for (const key of keys) {
      index.set(
        key,
        stored.get(key) ?? entryOf(key, storage.getItem(key) ?? '')
      );
    }
    this.known = index;
    this.knownText = text;
    return index;
  }

  private writeIndex(index: Index): void {
    const text = JSON.stringify({
      v: INDEX_VERSION,
      eintraege: Object.fromEntries(index),
    });
    try {
      this.storage?.setItem(ANSWER_INDEX, text);
      this.knownText = text;
    } catch {
      // not kept: the next pass rebuilds it from the answers
      this.known = undefined;
    }
  }
}

/** The keys of an index, oldest first, taken one by one; sorted on first need. */
class Oldest {
  private queue: string[] | undefined;

  public constructor(private readonly index: Index) {}

  public next(): string | undefined {
    this.queue ??= byAge(this.index);
    return this.queue.shift();
  }
}

/** Whether `index` names exactly the answers `keys` lists. */
function sameKeys(index: Index, key: readonly string[]): boolean {
  return index.size === key.length && key.every((key) => index.has(key));
}

function keyOf(path: string): string {
  return `${ANSWER_PREFIX}${path}`;
}

function tooOld(am: number, now: number): boolean {
  return now - am > MAX_AGE_MS;
}

/** Every answer's key in `storage`; reads no value. */
function answerKeys(storage: AnswerStorage): string[] {
  return Array.from({ length: storage.length }, (_, i) =>
    storage.key(i)
  ).filter(
    (key): key is string => key !== null && key.startsWith(ANSWER_PREFIX)
  );
}

/** What the index says of the answers; nothing where it cannot be read. */
function readIndex(text: string | null): Index {
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
        (pair): pair is [string, IndexEntry] => isIndexEntry(pair[1])
      )
    );
  } catch {
    return new Map();
  }
}

function isIndexEntry(value: unknown): value is IndexEntry {
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

function entryOf(key: string, text: string): IndexEntry {
  const stored = parsedAnswer(text);
  return {
    zeichen: key.length + text.length,
    am: stored?.am ?? Number.NEGATIVE_INFINITY,
    art: stored?.art ?? '',
  };
}

/** The keys of `index`, oldest first by when they were stored. */
function byAge(index: Index): string[] {
  return [...index].sort(([, a], [, b]) => a.am - b.am).map(([key]) => key);
}

/** A stored answer of this version, or `undefined` for anything else. */
function parsedAnswer(
  text: string | null | undefined
): StoredAnswer | undefined {
  if (!text) {
    return undefined;
  }
  try {
    const stored: unknown = JSON.parse(text);
    return isStoredAnswer(stored) ? stored : undefined;
  } catch {
    return undefined;
  }
}

function isStoredAnswer(value: unknown): value is StoredAnswer {
  return (
    typeof value === 'object' &&
    value !== null &&
    'v' in value &&
    value.v === VERSION &&
    'am' in value &&
    isInstant(value.am) &&
    'art' in value &&
    typeof value.art === 'string' &&
    'antwort' in value
  );
}

/** Whether `am` is a time a `Date` can hold, in ms since the epoch. */
function isInstant(am: unknown): am is number {
  return typeof am === 'number' && Number.isFinite(new Date(am).getTime());
}

function totalCharacters(index: Index): number {
  let characters = 0;
  for (const entry of index.values()) {
    characters += entry.zeichen;
  }
  return characters;
}
