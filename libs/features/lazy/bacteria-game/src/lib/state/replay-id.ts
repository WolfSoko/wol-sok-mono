/**
 * What a public replay's id looks like: an auto id of `publicReplays`
 * (Firestore's random ids). `publicSite` reads nothing else, and the watch
 * page checks it before it fetches anything.
 */
export const PUBLIC_ID = /^[A-Za-z0-9]{20}$/;

/**
 * The id of an online match's replay, which both devices and the server
 * work out alike without a word between them (ADR 0011): `o_` and a 64-bit
 * hash of the room code, the match number and the seed of its `start`.
 */
export function onlineReplayId(
  roomCode: string,
  n: number,
  seed: number
): string {
  const text = `${roomCode}:${n}:${seed}`;
  // Two FNV-1a hashes with other offsets, for 64 bits against collisions.
  return `o_${hex(fnv1a(text, 0x811c9dc5))}${hex(fnv1a(text, 0x050c5d1f))}`;
}

function fnv1a(text: string, offset: number): number {
  let hash = offset;
  for (let i = 0; i < text.length; i++) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  }
  // Mixed once more, so the two hashes do not stay alike.
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  return (hash ^ (hash >>> 16)) >>> 0;
}

function hex(value: number): string {
  return value.toString(16).padStart(8, '0');
}
