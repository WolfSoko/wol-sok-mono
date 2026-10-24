import type { Firestore } from 'firebase-admin/firestore';
import type { Engine } from '../engine';
import { refreshEntries } from './entries';

type Profile = Record<string, unknown> | undefined;

/** The preset id of a profile's avatar, null for any other picture. */
function presetOf(profile: Profile): number | null {
  const avatar = profile?.['avatar'] as { kind?: unknown; id?: unknown } | null;
  return avatar?.kind === 'preset' && typeof avatar.id === 'number'
    ? avatar.id
    : null;
}

/**
 * True when a profile change touches what the boards show: the name,
 * `publicName`, `boardOptOut` or a preset avatar.
 */
export function touchesBoards(before: Profile, after: Profile): boolean {
  return (
    before?.['name'] !== after?.['name'] ||
    (before?.['publicName'] === true) !== (after?.['publicName'] === true) ||
    (before?.['boardOptOut'] === true) !== (after?.['boardOptOut'] === true) ||
    presetOf(before) !== presetOf(after)
  );
}

/**
 * `boardProfileChanged` (ADR 0012): re-labels the player's entries on
 * every board in `boardMembers.boards` - the all-time boards and past
 * daily ones - when the name, `publicName`, `boardOptOut` or a preset
 * avatar changes. Never checks a ban: an owner's reset of a banned
 * player's profile must reach the boards too. Returns the entries changed.
 */
export async function boardProfileChanged(
  db: Firestore,
  engine: Engine,
  uid: string,
  before: Profile,
  after: Profile,
  now = Date.now()
): Promise<number> {
  if (!touchesBoards(before, after)) {
    return 0;
  }
  return refreshEntries(db, engine, uid, now);
}
