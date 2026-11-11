import { isDbbId } from '@wolsok/feat-shared-basketball-data';

/** A stored document's fields, or one of its maps, as read. */
export type RawDocument = Readonly<Record<string, unknown>>;

/** Marks an entry, or a part of one, that a change takes away. */
export const REMOVED = Symbol('entfernt');

/**
 * An entry of a stored map as read: its value and, in a list ordered by
 * when its entries joined, since when it is there.
 */
export interface ReadEntry<W> {
  readonly value: W;
  /**
   * Milliseconds since 1970; none in a list that keeps an order of its
   * own (`ListDescriptor.order`).
   */
  readonly since?: number;
}

/** An entry of a list ordered by when its entries joined, as read. */
export type EntrySince<W> = ReadEntry<W> & { readonly since: number };

/**
 * The order of the entries of a map, as the reader gives them: by `since`,
 * the id (`tieBreak`) deciding a tie.
 */
export function compareBySince(
  a: { readonly since: number; readonly tieBreak: number },
  b: { readonly since: number; readonly tieBreak: number }
): number {
  return a.since - b.since || a.tieBreak - b.tieBreak;
}

/**
 * `entries` in the reader's order (as `compareBySince`: by `since`, the id a tie),
 * `id` giving each its id; sorts the list it is given.
 */
export function bySince<W>(
  entries: EntrySince<W>[],
  id: (value: W) => number
): readonly EntrySince<W>[] {
  return entries.sort((a, b) => a.since - b.since || id(a.value) - id(b.value));
}

/** `entries` with each of `fields` set, or deleted where it goes. */
export function entriesWith(
  entries: RawDocument,
  fields: Readonly<Record<string, unknown>>
): RawDocument {
  const updated: Record<string, unknown> = { ...entries };
  for (const [id, field] of Object.entries(fields)) {
    if (field === REMOVED) {
      delete updated[id];
    } else {
      updated[id] = field;
    }
  }
  return updated;
}

/** The DBB id a map's key holds; `undefined` where it holds none. */
export function idOfKey(key: string): number | undefined {
  const id = Number(key);
  return isId(id) && String(id) === key ? id : undefined;
}

/** Whether `value` is a DBB id. */
export function isId(value: unknown): value is number {
  return typeof value === 'number' && isDbbId(value);
}

/** Whether `value` is a finite number. */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Whether `value` is a map: an object that is no list. */
export function isMap(value: unknown): value is RawDocument {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
