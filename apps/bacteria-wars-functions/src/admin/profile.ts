import { defaultProfile } from '@wolsok/feat-lazy-bac-game/engine';
import { createHash } from 'node:crypto';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { bumpModeration } from './notices';

/** What the audit keeps of a profile: never an uploaded image itself. */
export interface ProfileTrace {
  name: unknown;
  motto: unknown;
  avatar: string;
  /** An uploaded image's SHA-256 and size, so a repeat can be recognised. */
  image?: { sha256: string; size: number };
}

/** A stored profile as the audit records it. */
export function profileTrace(profile: Record<string, unknown>): ProfileTrace {
  const avatar = (profile['avatar'] ?? {}) as Record<string, unknown>;
  const data = avatar['data'];
  return {
    name: profile['name'] ?? null,
    motto: profile['motto'] ?? null,
    avatar: typeof avatar['kind'] === 'string' ? avatar['kind'] : 'none',
    ...(avatar['kind'] === 'image' && typeof data === 'string'
      ? {
          image: {
            sha256: createHash('sha256').update(data).digest('hex'),
            size: data.length,
          },
        }
      : {}),
  };
}

/**
 * The owner's profile actions (ADR 0012): `reset` gives the name, motto
 * and avatar of a fresh profile back, keeping what the player shares;
 * `removeImage` puts the uid's preset in place of the picture. Public
 * replays and board labels follow by themselves (`boardProfileChanged`).
 * Null when the player has no profile.
 */
export async function moderateProfile(
  db: Firestore,
  uid: string,
  action: 'reset' | 'removeImage'
): Promise<{ before: ProfileTrace; after: ProfileTrace } | null> {
  const ref = db.doc(`profiles/${uid}`);
  const stored = (await ref.get()).data();
  if (stored === undefined) {
    return null;
  }
  const fresh = defaultProfile(uid);
  const change =
    action === 'reset'
      ? { name: fresh.name, motto: '', avatar: fresh.avatar }
      : { avatar: fresh.avatar };
  await ref.update({ ...change, updatedAt: FieldValue.serverTimestamp() });
  await bumpModeration(
    db,
    uid,
    action === 'reset' ? 'resets' : 'imageRemovals'
  );
  return {
    before: profileTrace(stored),
    after: profileTrace({ ...stored, ...change }),
  };
}
