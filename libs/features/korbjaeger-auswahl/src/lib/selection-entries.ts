import { isDbbId } from '@wolsok/feat-shared-basketball-data';

/** A stored document's fields, or one of its maps, as read. */
export type RohesDokument = Readonly<Record<string, unknown>>;

/** Marks an entry, or a part of one, that a change takes away. */
export const ENTFERNT = Symbol('entfernt');

/** An entry of a stored map as read: its value and since when it is there. */
export interface ReadEntry<W> {
  readonly value: W;
  /** Milliseconds since 1970; 0 for a list whose entries keep no order of their own. */
  readonly since: number;
}

/**
 * The order of the entries of a map, as the reader gives them: by `seit`,
 * the id (`sortierung`) deciding a tie.
 */
export function vorSeit(
  a: { readonly seit: number; readonly sortierung: number },
  b: { readonly seit: number; readonly sortierung: number }
): number {
  return a.seit - b.seit || a.sortierung - b.sortierung;
}

/** `entries` in the reader's order (`vorSeit`), `id` giving each its id. */
export function bySince<W>(
  entries: readonly ReadEntry<W>[],
  id: (value: W) => number
): readonly ReadEntry<W>[] {
  return [...entries].sort((a, b) =>
    vorSeit(
      { seit: a.since, sortierung: id(a.value) },
      { seit: b.since, sortierung: id(b.value) }
    )
  );
}

/** `eintraege` with each of `felder` set, or deleted where it goes. */
export function eintraegeMit(
  eintraege: RohesDokument,
  felder: Readonly<Record<string, unknown>>
): RohesDokument {
  const neu: Record<string, unknown> = { ...eintraege };
  for (const [id, feld] of Object.entries(felder)) {
    if (feld === ENTFERNT) {
      delete neu[id];
    } else {
      neu[id] = feld;
    }
  }
  return neu;
}

/** The DBB id a map's key holds; `undefined` where it holds none. */
export function idAus(schluessel: string): number | undefined {
  const id = Number(schluessel);
  return istId(id) && String(id) === schluessel ? id : undefined;
}

/** Whether `wert` is a DBB id. */
export function istId(wert: unknown): wert is number {
  return typeof wert === 'number' && isDbbId(wert);
}

/** Whether `wert` is a finite number. */
export function istZahl(wert: unknown): wert is number {
  return typeof wert === 'number' && Number.isFinite(wert);
}

/** Whether `wert` is a map: an object that is no list. */
export function istKarte(wert: unknown): wert is RohesDokument {
  return typeof wert === 'object' && wert !== null && !Array.isArray(wert);
}
