import {
  type BoardKind,
  type BoardRef,
  type EntryShow,
  type EntryStatus,
  parseBoardId,
} from '@wolsok/feat-lazy-bac-game/engine';
import {
  type DocumentReference,
  FieldValue,
  type Firestore,
  type Transaction,
} from 'firebase-admin/firestore';
import { randomBytes } from 'node:crypto';
import { type BoardProfile, boardProfileOf, entryLabel } from './names';

/** Why an entry is hidden; any reason hides it. */
export type HiddenBy = Partial<Record<'ban' | 'admin' | 'optout', true>>;

/** What a ranking function decides about an entry. */
export interface EntryBase {
  sort: number;
  atHour: number;
  /** The status it shows when nothing hides it. */
  baseStatus: EntryStatus;
  show: EntryShow;
}

/**
 * `boards/{boardId}/entries/{entryId}` (ADR 0012): no uid, the label from
 * the profile, hidden while any reason in `hiddenBy` holds - a player's
 * opt-out (`boardOptOut`), the owner, a ban.
 */
export function entryData(
  entryId: string,
  base: EntryBase,
  profile: BoardProfile,
  hiddenBy: HiddenBy
) {
  const hidden: HiddenBy = { ...hiddenBy };
  if (profile.boardOptOut) {
    hidden.optout = true;
  } else {
    delete hidden.optout;
  }
  const status: EntryStatus =
    Object.keys(hidden).length > 0 ? 'hidden' : base.baseStatus;
  return {
    ...base,
    status,
    hiddenBy: hidden,
    ...entryLabel(entryId, profile, base.baseStatus),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

/** The hide reasons a stored entry carries. */
export function hiddenByOf(value: unknown): HiddenBy {
  if (typeof value !== 'object' || value === null) {
    return {};
  }
  const hidden: HiddenBy = {};
  for (const reason of ['ban', 'admin', 'optout'] as const) {
    if ((value as Record<string, unknown>)[reason] === true) {
      hidden[reason] = true;
    }
  }
  return hidden;
}

/**
 * The hide reasons of a player's entry of `kind`: the stored ones, and
 * `admin` while the owner bars the player from that kind
 * (`boardMembers/{uid}.barred`), so a new entry - tomorrow's daily one -
 * starts hidden too.
 */
export function hiddenFor(
  member: Record<string, unknown>,
  kind: BoardKind,
  stored: unknown
): HiddenBy {
  const hidden = hiddenByOf(stored);
  const barred = member['barred'];
  if (Array.isArray(barred) && barred.includes(kind)) {
    hidden.admin = true;
  }
  return hidden;
}

/**
 * A stored entry written again with a new label or new hide reasons, its
 * ranking as it was - for `tx.update`, so a daily entry keeps its
 * `expireAt`.
 */
export function entryRewrite(
  entryId: string,
  stored: Record<string, unknown>,
  profile: BoardProfile,
  hiddenBy: HiddenBy
) {
  return entryData(
    entryId,
    {
      sort: stored['sort'] as number,
      atHour: stored['atHour'] as number,
      baseStatus: (stored['baseStatus'] ?? stored['status']) as EntryStatus,
      show: stored['show'] as EntryShow,
    },
    profile,
    hiddenBy
  );
}

/** The board ids an entry of each kind sits on, one random id per kind. */
export type EntryIds = Record<BoardKind, string>;

/** Fresh entry ids: random, so rows on two boards cannot be tied together. */
export function newEntryIds(): EntryIds {
  const id = () => randomBytes(12).toString('base64url');
  return { xp: id(), online: id(), daily: id(), endless: id() };
}

/** A player's board membership, read in a transaction - see `memberIn`. */
export interface MemberRead {
  entryIds: EntryIds;
  data: Record<string, unknown>;
  /** True when this read made the entry ids: write them with the member. */
  fresh: boolean;
}

/**
 * Reads `boardMembers/{uid}` in a transaction, with entry ids made up for a
 * player who has none yet. The caller writes them back with its update.
 */
export async function memberIn(
  tx: Transaction,
  db: Firestore,
  uid: string
): Promise<MemberRead> {
  const snapshot = await tx.get(db.doc(`boardMembers/${uid}`));
  const data = snapshot.data() ?? {};
  const stored = data['entryIds'] as Partial<EntryIds> | undefined;
  const ids = newEntryIds();
  const entryIds: EntryIds = {
    xp: stored?.xp ?? ids.xp,
    online: stored?.online ?? ids.online,
    daily: stored?.daily ?? ids.daily,
    endless: stored?.endless ?? ids.endless,
  };
  return {
    entryIds,
    data,
    fresh: (['xp', 'online', 'daily', 'endless'] as const).some(
      (kind) => stored?.[kind] === undefined
    ),
  };
}

/** A player's profile as the boards read it, in a transaction. */
export async function profileIn(
  tx: Transaction,
  db: Firestore,
  uid: string
): Promise<BoardProfile> {
  return boardProfileOf((await tx.get(db.doc(`profiles/${uid}`))).data());
}

/** One of a player's entries, as `boardMembers/{uid}` lists it. */
export interface MemberEntry {
  boardId: string;
  board: BoardRef;
  entryId: string;
}

/**
 * The entries a `boardMembers/{uid}` document points to: one per board in
 * its `boards` with an id in its `entryIds` - what relabelling and account
 * deletion go through.
 */
export function memberEntries(
  member: Record<string, unknown> | undefined
): MemberEntry[] {
  const boards = member?.['boards'];
  const entryIds = (member?.['entryIds'] ?? {}) as Partial<EntryIds>;
  const entries: MemberEntry[] = [];
  for (const boardId of Array.isArray(boards) ? boards : []) {
    const board = typeof boardId === 'string' ? parseBoardId(boardId) : null;
    const entryId = board === null ? undefined : entryIds[board.kind];
    if (entryId !== undefined && board !== null) {
      entries.push({ boardId, board, entryId });
    }
  }
  return entries;
}

/**
 * Adds or takes away one hide reason on each of the player's entries
 * (`boardMembers/{uid}`), or only on `only`, one transaction per entry,
 * keeping what else hides it. With `guard`, an entry also reads that
 * document in the same round trip and stays as it is while `keeps` says so
 * of it. Updated in place, so a daily entry keeps its `expireAt`. Returns
 * how many entries changed.
 */
export async function setHidden(
  db: Firestore,
  uid: string,
  reason: 'ban' | 'admin',
  hide: boolean,
  {
    only,
    guard,
  }: {
    only?: { boardId: string; entryId: string };
    guard?: {
      ref: DocumentReference;
      keeps: (data: Record<string, unknown> | undefined) => boolean;
    };
  } = {}
): Promise<number> {
  const member = await db.doc(`boardMembers/${uid}`).get();
  let changed = 0;
  for (const { boardId, entryId } of memberEntries(member.data())) {
    if (
      only !== undefined &&
      (only.boardId !== boardId || only.entryId !== entryId)
    ) {
      continue;
    }
    const ref = db.doc(`boards/${boardId}/entries/${entryId}`);
    const done = await db.runTransaction(async (tx) => {
      const [entry, guarded] =
        guard === undefined
          ? [await tx.get(ref), undefined]
          : await tx.getAll(ref, guard.ref);
      const data = entry?.data();
      if (data === undefined) {
        return false;
      }
      const hiddenBy = hiddenByOf(data['hiddenBy']);
      if ((hiddenBy[reason] === true) === hide) {
        return false;
      }
      if (guard?.keeps(guarded?.data()) === true) {
        return false;
      }
      if (hide) {
        hiddenBy[reason] = true;
      } else {
        delete hiddenBy[reason];
      }
      const profile = await profileIn(tx, db, uid);
      tx.update(ref, entryRewrite(entryId, data, profile, hiddenBy));
      return true;
    });
    changed += done ? 1 : 0;
  }
  return changed;
}
