import { randomInt } from 'node:crypto';
import {
  DocumentReference,
  DocumentSnapshot,
  Firestore,
  Timestamp,
  Transaction,
} from 'firebase-admin/firestore';
import type {
  BoardKind,
  EntryShow,
  EntryStatus,
} from '@wolsok/feat-lazy-bac-game/engine';
import type { Engine } from '../engine';
import { isBanned } from '../limits';
import { publicNameOf } from '../replays/public-name';
import { DAY_MS, dayStart } from '../time';
import type { EntryDoc, HiddenBy, MemberDoc, ShownStatus } from './model';

/**
 * Board entries and the player's member document (ADR 0012): who appears
 * under which name, and what hides them. Every writer of an entry goes
 * through {@link putEntry}, so the name, the label and the hiding follow
 * the same rules everywhere.
 */

type Profile = Record<string, unknown> | undefined;

/** What decides how a player's entries show, read once per transaction. */
export interface Standing {
  /** True while a ban has not ended. */
  banned: boolean;
  profile: Profile;
}

/** The characters of a random id. */
const ID_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** A random id of 20 letters and digits, like Firestore's own. */
export function randomId(): string {
  return Array.from(
    { length: 20 },
    () => ID_CHARS[randomInt(ID_CHARS.length)]
  ).join('');
}

export function memberRef(db: Firestore, uid: string): DocumentReference {
  return db.doc(`boardMembers/${uid}`);
}

export function entryRef(
  db: Firestore,
  boardId: string,
  entryId: string
): DocumentReference {
  return db.doc(`boards/${boardId}/entries/${entryId}`);
}

/**
 * The member document as stored, or a fresh one: a random entry id per
 * board kind, so rows on two boards cannot be tied together.
 */
export function memberOf(snapshot: DocumentSnapshot | undefined): MemberDoc {
  const data = (snapshot?.exists ? snapshot.data() : undefined) as
    | Partial<MemberDoc>
    | undefined;
  const ids = data?.entryIds;
  return {
    ...data,
    entryIds: {
      xp: ids?.xp ?? randomId(),
      online: ids?.online ?? randomId(),
      daily: ids?.daily ?? randomId(),
      endless: ids?.endless ?? randomId(),
    },
    boards: data?.boards ?? [],
    barred: data?.barred ?? [],
    hiddenBy: data?.hiddenBy ?? {},
  };
}

/** Reads what decides how the player's entries show, inside a transaction. */
export async function readStanding(
  tx: Transaction,
  db: Firestore,
  uid: string,
  now: number
): Promise<Standing> {
  const [ban, profile] = await tx.getAll(...standingRefs(db, uid));
  return standingOf(ban, profile, now);
}

/** What {@link readStanding} reads: the player's ban and profile. */
export function standingRefs(
  db: Firestore,
  uid: string
): [DocumentReference, DocumentReference] {
  return [db.doc(`bans/${uid}`), db.doc(`profiles/${uid}`)];
}

/** The standing from the snapshots of {@link standingRefs}. */
export function standingOf(
  ban: DocumentSnapshot,
  profile: DocumentSnapshot,
  now: number
): Standing {
  return {
    banned: banActive(ban, now),
    profile: profile.exists ? profile.data() : undefined,
  };
}

/** True when a `bans/{uid}` snapshot holds a ban that has not ended. */
function banActive(ban: DocumentSnapshot, now: number): boolean {
  if (!ban.exists) {
    return false;
  }
  const until = ban.get('until') as Timestamp | null | undefined;
  return isBanned(until == null ? null : until.toMillis(), now);
}

/** The kind of board an id names - throws for anything else. */
export function kindOf(engine: Engine, boardId: string): BoardKind {
  const board = engine.parseBoardId(boardId);
  if (board === null) {
    throw new Error(`Not a board: ${boardId}`);
  }
  return board.kind;
}

/**
 * Why the player's entry on a board is hidden, null when it is not: the
 * owner's hide or bar first, then a ban, then the player's own opt-out.
 */
export function hideReason(
  member: MemberDoc,
  boardId: string,
  kind: BoardKind,
  standing: Standing
): HiddenBy | null {
  if (member.hiddenBy[boardId] === 'admin' || member.barred.includes(kind)) {
    return 'admin';
  }
  if (standing.banned) {
    return 'ban';
  }
  return standing.profile?.['boardOptOut'] === true ? 'optout' : null;
}

/** Keeps `member.hiddenBy` in line with what hides each board's entry now. */
export function noteHidden(
  member: MemberDoc,
  boardId: string,
  reason: HiddenBy | null
): void {
  if (reason === null) {
    delete member.hiddenBy[boardId];
  } else {
    member.hiddenBy[boardId] = reason;
  }
}

/** How an entry shows: status, name, label and picture. */
export function labelOf(
  engine: Engine,
  entryId: string,
  baseStatus: ShownStatus,
  hidden: HiddenBy | null,
  profile: Profile
): Pick<EntryDoc, 'status' | 'name' | 'tag' | 'avatar'> {
  const status: EntryStatus = hidden === null ? baseStatus : 'hidden';
  const name =
    hidden === null && engine.showsName(baseStatus)
      ? publicNameOf(engine, profile)
      : null;
  const avatar = profile?.['avatar'] as { kind?: unknown; id?: unknown } | null;
  const ownPreset =
    name !== null &&
    avatar?.kind === 'preset' &&
    typeof avatar.id === 'number' &&
    avatar.id >= 0 &&
    avatar.id < engine.AVATAR_COUNT
      ? avatar.id
      : null;
  return {
    status,
    name,
    tag: engine.boardTag(entryId),
    avatar: ownPreset ?? engine.boardAvatar(entryId),
  };
}

/** Days past their day a daily board's documents are kept. */
export function dailyExpireAt(day: string): Timestamp {
  return Timestamp.fromMillis(dayStart(day) + 32 * DAY_MS);
}

/** Adds a board to the member's list, dropping daily boards past their TTL. */
export function addBoard(
  engine: Engine,
  member: MemberDoc,
  boardId: string,
  now: number
): void {
  const keep = member.boards.filter((id) => {
    const board = engine.parseBoardId(id);
    return (
      board !== null &&
      (board.kind !== 'daily' || dailyExpireAt(board.day).toMillis() > now)
    );
  });
  member.boards = keep.includes(boardId) ? keep : [...keep, boardId];
  for (const id of Object.keys(member.hiddenBy)) {
    if (!member.boards.includes(id)) {
      delete member.hiddenBy[id];
    }
  }
}

/** What a writer says of an entry; the rest follows from the player. */
export interface EntryScore {
  sort: number;
  atHour: number;
  baseStatus: ShownStatus;
  show: EntryShow;
}

/**
 * Writes the player's entry on a board inside a transaction - its label
 * and hiding worked out from the member and the standing - and notes the
 * board in the member, which the caller writes. Returns the entry.
 */
export function putEntry(
  tx: Transaction,
  db: Firestore,
  engine: Engine,
  args: {
    boardId: string;
    member: MemberDoc;
    standing: Standing;
    score: EntryScore;
    now: number;
  }
): EntryDoc {
  const { boardId, member, standing, score, now } = args;
  const kind = kindOf(engine, boardId);
  const entryId = member.entryIds[kind];
  addBoard(engine, member, boardId, now);
  const hidden = hideReason(member, boardId, kind, standing);
  noteHidden(member, boardId, hidden);
  const board = engine.parseBoardId(boardId);
  const entry: EntryDoc = {
    ...score,
    ...labelOf(engine, entryId, score.baseStatus, hidden, standing.profile),
    updatedAt: Timestamp.fromMillis(now),
    ...(board?.kind === 'daily' ? { expireAt: dailyExpireAt(board.day) } : {}),
  };
  tx.set(entryRef(db, boardId, entryId), entry);
  return entry;
}

/**
 * Re-labels all the player's entries from their profile, ban and the
 * owner's hides: `boardProfileChanged`, a ban, an unban, a hide or a
 * restore all end here. Writes only entries that change. Returns how many.
 */
export async function refreshEntries(
  db: Firestore,
  engine: Engine,
  uid: string,
  now = Date.now(),
  change: (member: MemberDoc) => void = () => undefined
): Promise<number> {
  return db.runTransaction(async (tx) => {
    const memberSnap = await tx.get(memberRef(db, uid));
    if (!memberSnap.exists) {
      return 0;
    }
    const member = memberOf(memberSnap);
    const standing = await readStanding(tx, db, uid, now);
    const boards = member.boards.filter(
      (id) => engine.parseBoardId(id) !== null
    );
    const refs = boards.map((id) =>
      entryRef(db, id, member.entryIds[kindOf(engine, id)])
    );
    const entries = refs.length === 0 ? [] : await tx.getAll(...refs);
    change(member);
    let changed = 0;
    boards.forEach((boardId, index) => {
      const snapshot = entries[index];
      const kind = kindOf(engine, boardId);
      const hidden = hideReason(member, boardId, kind, standing);
      noteHidden(member, boardId, hidden);
      if (!snapshot.exists) {
        return;
      }
      const entry = snapshot.data() as EntryDoc;
      const baseStatus =
        entry.baseStatus ??
        (entry.status === 'hidden' ? 'counted' : entry.status);
      const label = labelOf(
        engine,
        member.entryIds[kind],
        baseStatus,
        hidden,
        standing.profile
      );
      if (
        label.status !== entry.status ||
        label.name !== entry.name ||
        label.avatar !== entry.avatar ||
        label.tag !== entry.tag
      ) {
        tx.update(snapshot.ref, {
          ...label,
          baseStatus,
          updatedAt: Timestamp.fromMillis(now),
        });
        changed++;
      }
    });
    tx.set(memberRef(db, uid), {
      ...member,
      hiddenBy: member.hiddenBy,
      barred: member.barred,
    });
    return changed;
  });
}
