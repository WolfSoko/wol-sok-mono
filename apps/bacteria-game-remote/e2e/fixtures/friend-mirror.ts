// What `mirrorFriend` (apps/bacteria-wars-functions/src/social/mirror.ts)
// does in production, for the emulators, which run no functions: every
// friend-list entry `players/{owner}/friends/{reader}` becomes
// `statusReaders/{owner}/{reader}: true`, so the friends-only read rule of
// `status/{owner}` lets that friend read it. `Bearer owner` is the
// emulators' admin, which the rules let through. Ports and project are the
// game's (environment.emulator.ts).

const PROJECT = 'demo-bacteria-wars';
const FIRESTORE = `http://127.0.0.1:8380/v1/projects/${PROJECT}/databases/(default)/documents`;
const DATABASE = `http://127.0.0.1:9410/statusReaders.json?ns=${PROJECT}-default-rtdb`;
const ADMIN = { Authorization: 'Bearer owner' };
const FRIEND = /\/players\/([^/]+)\/friends\/([^/]+)$/;

/** Mirrors every friend list in the emulators into `statusReaders`. */
export async function mirrorFriendLists(): Promise<void> {
  const listed = await fetch(`${FIRESTORE}:runQuery`, {
    method: 'POST',
    headers: { ...ADMIN, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'friends', allDescendants: true }],
        select: { fields: [] },
      },
    }),
  });
  if (!listed.ok) {
    throw new Error(`The friend lists were not read: ${listed.status}`);
  }
  const rows = (await listed.json()) as { document?: { name: string } }[];
  const readers: Record<string, true> = {};
  for (const { document } of rows) {
    const [, owner, reader] = document?.name.match(FRIEND) ?? [];
    if (owner !== undefined && reader !== undefined) {
      readers[`${owner}/${reader}`] = true;
    }
  }
  if (Object.keys(readers).length === 0) {
    return;
  }
  // A multi-path update: each key is a path under `statusReaders`.
  const written = await fetch(DATABASE, {
    method: 'PATCH',
    headers: ADMIN,
    body: JSON.stringify(readers),
  });
  if (!written.ok) {
    throw new Error(`The mirror was not written: ${written.status}`);
  }
}
