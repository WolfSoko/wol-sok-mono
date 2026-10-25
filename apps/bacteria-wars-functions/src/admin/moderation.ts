import { createHash } from 'node:crypto';
import {
  BOARD_KINDS,
  defaultProfile,
  parseBoardId,
} from '@wolsok/feat-lazy-bac-game/engine';
import {
  type DocumentReference,
  FieldValue,
  type Firestore,
  type SetOptions,
} from 'firebase-admin/firestore';
import { barredOf, memberEntries, setHidden } from '../boards/entries';
import { noticeData, type NoticeType } from './records';

/**
 * The owner's moderation of profiles and boards (ADR 0012): `profile.*`
 * and `board.hideEntry`, `board.hidePlayer`, `board.restore`. Each tells
 * the player with a notice and counts in `moderation/{uid}` where the ADR
 * says so, once it changed something; `boardProfileChanged` and
 * `profileChanged` carry a profile change on to the boards and the
 * replays by themselves.
 */

/** What a moderation command changed, for the audit. */
export interface ModerationChange {
  before: unknown;
  after: unknown;
}

/**
 * `profile.reset` (name from the uid, motto empty, the uid's preset
 * avatar, the rest kept; notice `profile-reset`, `moderation.resets` + 1)
 * or `profile.removeImage` (the preset avatar, the rest kept; notice
 * `image-removed`, `moderation.imageRemovals` + 1), in one transaction.
 * The audit keeps what was replaced - for an image its SHA-256 and size,
 * never the image. `not-found` without a profile, `no-image` for a
 * picture that is one of the drawn bacteria already, `unchanged` for a
 * profile that is reset already.
 */
export async function moderateProfile(
  db: Firestore,
  uid: string,
  what: 'reset' | 'removeImage',
  noticeId: string,
  now: number
): Promise<ModerationChange | 'not-found' | 'no-image' | 'unchanged'> {
  const ref = db.doc(`profiles/${uid}`);
  const fresh = defaultProfile(uid);
  return db.runTransaction(async (tx) => {
    const profile = (await tx.get(ref)).data();
    if (profile === undefined) {
      return 'not-found';
    }
    const avatar = avatarOf(profile['avatar']);
    const drawn =
      avatar['kind'] === 'preset' &&
      fresh.avatar.kind === 'preset' &&
      avatar['id'] === fresh.avatar.id;
    if (what === 'removeImage' && avatar['kind'] === 'preset') {
      return 'no-image';
    }
    const reset = what === 'reset';
    const name = typeof profile['name'] === 'string' ? profile['name'] : null;
    const motto = typeof profile['motto'] === 'string' ? profile['motto'] : '';
    if (reset && drawn && name === fresh.name && motto === '') {
      return 'unchanged';
    }
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
      { [reset ? 'resets' : 'imageRemovals']: FieldValue.increment(1) }
    );
    return {
      before: reset ? { name, motto, avatar } : { avatar },
      after: change,
    };
  });
}

/**
 * An avatar as the audit keeps it: its kind (a preset's id too), and an
 * image's fingerprint.
 */
function avatarOf(value: unknown): Record<string, unknown> {
  const avatar = (value ?? {}) as Record<string, unknown>;
  const kind = typeof avatar['kind'] === 'string' ? avatar['kind'] : 'preset';
  const data = avatar['data'];
  if (kind === 'image' && typeof data === 'string') {
    return {
      kind,
      sha256: createHash('sha256').update(data).digest('hex'),
      size: data.length,
    };
  }
  return kind === 'preset' && typeof avatar['id'] === 'number'
    ? { kind, id: avatar['id'] }
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
 * new entries of it hidden, and all their entries of the kind are hidden -
 * every daily board they are on, for a daily entry. A restore lifts the
 * bars it covers, and of a barred kind brings back all its entries. A
 * hide that changed something tells the player (`board-hidden`) and counts
 * in `moderation.hides`. `not-on-board` for an entry the player does not
 * hold.
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
  const kind =
    scope === 'all' ? null : (parseBoardId(scope.boardId)?.kind ?? null);
  const kinds = kind === null ? BOARD_KINDS : [kind];
  // The bar first, so an entry ranked meanwhile starts hidden; a restore
  // lifts it first too, and the entries keep their hide until changed.
  const barred = await db.runTransaction(async (tx) => {
    const member = (await tx.get(memberRef)).data();
    const held =
      scope === 'all' ||
      memberEntries(member).some(
        (entry) =>
          entry.boardId === scope.boardId && entry.entryId === scope.entryId
      );
    if (!held) {
      return null;
    }
    const before = barredOf(member);
    const after = hide
      ? bar
        ? BOARD_KINDS.filter((k) => before.includes(k) || kinds.includes(k))
        : before
      : before.filter((k) => !kinds.includes(k));
    if (after.length !== before.length) {
      tx.set(memberRef, { barred: after }, { merge: true });
    }
    return { before, after };
  });
  if (barred === null) {
    return 'not-on-board';
  }
  // A bar, or lifting one, takes all the entries of its kind.
  const wide =
    scope === 'all' ||
    (hide ? bar : barred.before.some((k) => kinds.includes(k)));
  const entries = await setHidden(
    db,
    uid,
    'admin',
    hide,
    wide ? (kind === null ? {} : { kind }) : { only: scope }
  );
  if (hide && (entries > 0 || barred.after.length > barred.before.length)) {
    const batch = db.batch();
    tell(batch, db, uid, noticeId, 'board-hidden', now, {
      hides: FieldValue.increment(1),
    });
    await batch.commit();
  }
  return {
    before: { barred: barred.before },
    after: { barred: barred.after, entries },
  };
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
