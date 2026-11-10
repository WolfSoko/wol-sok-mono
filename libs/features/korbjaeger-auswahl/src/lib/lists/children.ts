import {
  ENTFERNT,
  idAus,
  istKarte,
  istZahl,
  bySince,
  type EntrySince,
  type RohesDokument,
} from '../selection-entries';
import type { ListDescriptor } from '../list-descriptor';
import { kindMit, type Kind } from '../kind';

/** A marked Kind as stored: since when it is marked, and its Spitzname. */
export interface KindEintrag {
  /** Milliseconds since 1970, the order of the Kinder. */
  readonly since: number;
  readonly nickname?: string;
}

/** What a change writes of a Kind: all of it, its Spitzname, or that it goes. */
export type KindFeld =
  | KindEintrag
  | { readonly nickname: string | typeof ENTFERNT }
  | typeof ENTFERNT;

/**
 * The marked Kinder, stored as `children: { [personId]: KindEintrag }`, in
 * the order they were marked. An entry it cannot read is left out, the
 * rest of the document kept.
 */
export const CHILDREN: ListDescriptor<Kind, KindFeld, 'children'> = {
  field: 'children',
  id: (kind) => kind.personId,
  equals: (a, b) => a.personId === b.personId && a.spitzname === b.spitzname,
  read: (raw) => {
    if (!istKarte(raw)) {
      return [];
    }
    const entries: EntrySince<Kind>[] = [];
    for (const [key, entry] of Object.entries(raw)) {
      const personId = idAus(key);
      if (personId !== undefined && istKindEintrag(entry)) {
        entries.push({
          value: kindMit(personId, entry.nickname),
          since: entry.since,
        });
      }
    }
    return bySince(entries, (kind) => kind.personId);
  },
  added: ({ spitzname }, since) => ({
    since: since(),
    ...(spitzname && { nickname: spitzname }),
  }),
  changed: (_alt, { spitzname }) => ({ nickname: spitzname ?? ENTFERNT }),
  merge: childrenWith,
  // a Spitzname only the device knows completes the account's Kind
  complete: (account, device) =>
    account.spitzname !== undefined || device.spitzname === undefined
      ? account
      : { personId: account.personId, spitzname: device.spitzname },
};

function istKindEintrag(entry: unknown): entry is KindEintrag {
  return (
    istKarte(entry) &&
    istZahl(entry['since']) &&
    (entry['nickname'] === undefined || typeof entry['nickname'] === 'string')
  );
}

/**
 * `children` with `fields` merged in; a Spitzname for a Kind no longer
 * marked is dropped.
 */
function childrenWith(
  children: RohesDokument,
  fields: Readonly<Record<string, KindFeld>>
): RohesDokument {
  const merged: Record<string, unknown> = { ...children };
  for (const [id, field] of Object.entries(fields)) {
    const previous = merged[id];
    if (field === ENTFERNT) {
      delete merged[id];
    } else if ('since' in field) {
      merged[id] = { ...(istKarte(previous) ? previous : {}), ...field };
    } else if (istKarte(previous)) {
      const { nickname: _previous, ...withoutNickname } = previous;
      merged[id] =
        field.nickname === ENTFERNT
          ? withoutNickname
          : { ...withoutNickname, nickname: field.nickname };
    }
  }
  return merged;
}
