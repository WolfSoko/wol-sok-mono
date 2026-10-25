import { createHash } from 'node:crypto';
import {
  type BoardKind,
  defaultProfile,
  parseBoardId,
} from '@wolsok/feat-lazy-bac-game/engine';
import {
  type DocumentReference,
  FieldValue,
  type Firestore,
  type SetOptions,
} from 'firebase-admin/firestore';
import { setHidden } from '../boards/entries';
import { noticeData, type NoticeType } from './records';

/**
 * The owner's moderation of profiles and boards (ADR 0012): `profile.*`
 * and `board.hideEntry`, `board.hidePlayer`, `board.restore`. Each tells
 * the player with a notice and counts in `moderation/{uid}` where the ADR
 * says so; `boardProfileChanged` and `profileChanged` carry a profile
 * change on to the boards and the replays by themselves.
 */

/** What a moderation command changed, for the audit. */
export interface ModerationChange {
  before: unknown;
  after: unknown;
}

const ALL_KINDS: readonly BoardKind[] = ['xp', 'online', 'daily', 'endless'];

/**
 * `profile.reset` (name from the uid, motto empty, the uid's preset
 * avatar, the rest kept; notice `profile-reset`, `moderation.resets` + 1)
 * or `profile.removeImage` (the preset avatar, the rest kept; notice
 * `image-removed`, `moderation.imageRemovals` + 1), in one transaction.
 * The audit keeps what was replaced - for an image its SHA-256 and size,
 * never the image. `not-found` without a profile, `no-image` for a
 * picture that is one of the drawn bacteria already.
 */
export async function moderateProfile(
  db: Firestore,
  uid: string,
  what: 'reset' | 'removeImage',
  noticeId: string,
  now: number
): Promise<ModerationChange | 'not-found' | 'no-image'> {
  const ref = db.doc(`profiles/${uid}`);
  const fresh = defaultProfile(uid);
  return db.runTransaction(async (tx) => {
    const profile = (await tx.get(ref)).data();
    if (profile === undefined) {
      return 'not-found';
    }
    const avatar = avatarOf(profile['avatar']);
    if (what === 'removeImage' && avatar.kind === 'preset') {
      return 'no-image';
    }
    const reset = what === 'reset';
    const change = reset
      ? { name: fresh.name, motto: '', avatar: fresh.avatar }
      : { avatar: fresh.avatar };
    tx.update(ref, { ...change, updatedAt: FieldValue.serverTimestamp() });
    tell(
      tx,
      db,
      uid,
      noticeId,
      reset ? 'profile-reset' : 'image-removed',
      now,
      {
        [reset ? 'resets' : 'imageRemovals']: FieldValue.increment(1),
      }
    );
    return {
      before: reset
        ? { name: profile['name'], motto: profile['motto'], avatar }
        : { avatar },
      after: change,
    };
  });
}

/** An avatar as the audit keeps it: its kind, and an image's fingerprint. */
function avatarOf(value: unknown): Record<string, unknown> {
  const avatar = (value ?? {}) as Record<string, unknown>;
  const kind = typeof avatar['kind'] === 'string' ? avatar['kind'] : 'preset';
  const data = avatar['data'];
  return kind === 'image' && typeof data === 'string'
    ? {
        kind,
        sha256: createHash('sha256').update(data).digest('hex'),
        size: data.length,
      }
    : { kind };
}

/** Which entries a board command takes: one, or all of the player's. */
export type BoardScope = { boardId: string; entryId: string } | 'all';

/**
 * `board.hideEntry` and `board.hidePlayer` (`hide`), `board.restore`
 * (not): hides the entry or all the player's entries (`hiddenBy.admin`),
 * or brings them back with their previous status; other reasons to hide
 * stay. With `bar`, the player is barred from that board kind (every kind
 * for all their entries): `boardMembers/{uid}.barred`, which starts their
 * new entries of it hidden. A restore lifts the bars it covers. A hide
 * tells the player (`board-hidden`) and counts in `moderation.hides`.
 * `not-on-board` for an entry the player does not hold.
 */
export async function moderateBoards(
  db: Firestore,
  uid: string,
  scope: BoardScope,
  { hide, bar }: { hide: boolean; bar: boolean },
  noticeId: string,
  now: number
): Promise<ModerationChange | 'not-on-board'> {
  const memberRef = db.doc(`boardMembers/${uid}`);
  const member = (await memberRef.get()).data();
  const kind =
    scope === 'all' ? null : (parseBoardId(scope.boardId)?.kind ?? null);
  if (scope !== 'all' && (kind === null || !holds(member, scope, kind))) {
    return 'not-on-board';
  }
  const kinds = kind === null ? ALL_KINDS : [kind];
  const barred = barredOf(member);
  // The bar first, so an entry ranked meanwhile starts hidden; a restore
  // lifts it first too, and the entries keep their hide until changed.
  const batch = db.batch();
  if (hide && bar) {
    batch.set(
      memberRef,
      { barred: FieldValue.arrayUnion(...kinds) },
      { merge: true }
    );
  } else if (!hide && barred.some((k) => kinds.includes(k))) {
    batch.update(memberRef, { barred: FieldValue.arrayRemove(...kinds) });
  }
  if (hide) {
    tell(batch, db, uid, noticeId, 'board-hidden', now, {
      hides: FieldValue.increment(1),
    });
  }
  await batch.commit();
  const entries = await setHidden(
    db,
    uid,
    'admin',
    hide,
    scope === 'all' ? {} : { only: scope }
  );
  const after =
    hide && bar
      ? [...new Set([...barred, ...kinds])]
      : hide
        ? barred
        : barred.filter((k) => !kinds.includes(k));
  return { before: { barred }, after: { barred: after, entries } };
}

/** True when the player holds that entry on that board. */
function holds(
  member: Record<string, unknown> | undefined,
  scope: { boardId: string; entryId: string },
  kind: BoardKind
): boolean {
  const ids = member?.['entryIds'] as Record<string, unknown> | undefined;
  const boards = member?.['boards'];
  return (
    ids?.[kind] === scope.entryId &&
    Array.isArray(boards) &&
    boards.includes(scope.boardId)
  );
}

function barredOf(member: Record<string, unknown> | undefined): BoardKind[] {
  const barred = member?.['barred'];
  return Array.isArray(barred)
    ? ALL_KINDS.filter((kind) => barred.includes(kind))
    : [];
}

/** Writes the player's notice and the moderation counts with a change. */
function tell(
  writer: {
    set(
      ref: DocumentReference,
      data: Record<string, unknown>,
      options: SetOptions
    ): unknown;
  },
  db: Firestore,
  uid: string,
  noticeId: string,
  type: NoticeType,
  now: number,
  counts: Record<string, unknown>
): void {
  writer.set(
    db.doc(`players/${uid}/notices/${noticeId}`),
    noticeData(type, now),
    {}
  );
  writer.set(db.doc(`moderation/${uid}`), counts, { merge: true });
}
