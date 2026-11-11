import {
  REMOVED,
  idOfKey,
  isMap,
  isNumber,
  bySince,
  type EntrySince,
  type RawDocument,
} from '../selection-entries';
import type { ListDescriptor } from '../list-descriptor';
import { childWith, type Child } from '../child';

/** A marked Kind as stored: since when it is marked, and its Spitzname. */
export interface ChildEntry {
  /** Milliseconds since 1970, the order of the Kinder. */
  readonly since: number;
  readonly nickname?: string;
}

/** What a change writes of a Kind: all of it, its Spitzname, or that it goes. */
export type ChildField =
  | ChildEntry
  | { readonly nickname: string | typeof REMOVED }
  | typeof REMOVED;

/**
 * The marked Kinder, stored as `children: { [personId]: ChildEntry }`, in
 * the order they were marked. An entry it cannot read is left out, the
 * rest of the document kept.
 */
export const CHILDREN: ListDescriptor<Child, ChildField, 'children'> = {
  field: 'children',
  id: (child) => child.personId,
  equals: (a, b) => a.personId === b.personId && a.nickname === b.nickname,
  read: (raw) => {
    if (!isMap(raw)) {
      return [];
    }
    const entries: EntrySince<Child>[] = [];
    for (const [key, entry] of Object.entries(raw)) {
      const personId = idOfKey(key);
      if (personId !== undefined && isChildEntry(entry)) {
        entries.push({
          value: childWith(personId, entry.nickname),
          since: entry.since,
        });
      }
    }
    return bySince(entries, (child) => child.personId);
  },
  added: ({ nickname }, since) => ({
    since: since(),
    ...(nickname && { nickname }),
  }),
  changed: (_previous, { nickname }) => ({ nickname: nickname ?? REMOVED }),
  merge: childrenWith,
  // a Spitzname only the device knows completes the account's Kind
  complete: (account, device) =>
    account.nickname !== undefined || device.nickname === undefined
      ? account
      : { personId: account.personId, nickname: device.nickname },
};

function isChildEntry(entry: unknown): entry is ChildEntry {
  return (
    isMap(entry) &&
    isNumber(entry['since']) &&
    (entry['nickname'] === undefined || typeof entry['nickname'] === 'string')
  );
}

/**
 * `children` with `fields` merged in; a Spitzname for a Kind no longer
 * marked is dropped.
 */
function childrenWith(
  children: RawDocument,
  fields: Readonly<Record<string, ChildField>>
): RawDocument {
  const merged: Record<string, unknown> = { ...children };
  for (const [id, field] of Object.entries(fields)) {
    const previous = merged[id];
    if (field === REMOVED) {
      delete merged[id];
    } else if ('since' in field) {
      merged[id] = { ...(isMap(previous) ? previous : {}), ...field };
    } else if (isMap(previous)) {
      const { nickname: _previous, ...withoutNickname } = previous;
      merged[id] =
        field.nickname === REMOVED
          ? withoutNickname
          : { ...withoutNickname, nickname: field.nickname };
    }
  }
  return merged;
}
