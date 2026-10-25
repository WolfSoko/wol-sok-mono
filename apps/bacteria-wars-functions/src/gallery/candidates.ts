import {
  BALANCE_VERSION,
  TICKS_PER_SEC,
} from '@wolsok/feat-lazy-bac-game/engine';
import { DAY_MS } from '../boards/budgets';
import type { ReplaySummary } from '../boards/verify';
import type { AccountInfo } from '../boards/verify-slice';

/**
 * Which stored replays the gallery takes (ADR 0011, changed by ADR 0012),
 * pure so the specs check every rule without Firestore.
 */

/** Candidates `featureBest` looks at a day at most... */
export const MAX_CANDIDATES = 20;
/** ...at most this many per player. */
export const MAX_PER_PLAYER = 3;
/** Replays published a day at most... */
export const MAX_PUBLISHED = 10;
/** ...scoring at least this... */
export const MIN_SCORE = 60;
/** ...one per player and two per level. */
export const MAX_PER_LEVEL = 2;
/** How old an account must be for its matches to be candidates. */
export const MIN_ACCOUNT_AGE_MS = 7 * DAY_MS;
/** The longest match the gallery shows: 6 minutes. */
export const MAX_GALLERY_TICKS = 6 * 60 * TICKS_PER_SEC;

/** The fields of `replays/{id}` the gallery reads. */
export interface GalleryReplay {
  kind: 'online' | 'computer' | 'daily' | 'endless';
  state: string;
  levelId: string;
  balanceVersion: number;
  ticks: number;
  winnerSeat: number | null;
  /** The client's own score, 0-100 - how candidates are ranked. */
  hint: number;
  /** Who reported it: a local match's player, an online match's reporters. */
  players: string[];
  /** Online only: the room's host and guest, null for a deleted account. */
  seats?: (string | null)[];
  optOut: string[];
  /** Taken out of the gallery for good. */
  galleryOut?: boolean;
  /** Online only: the room stub had expired - never public. */
  stubExpired?: boolean;
  /** A ranked attempt: the boards verify it, not the gallery. */
  attempt?: unknown;
  /** What the server's re-run found - set once it is verified. */
  summary?: ReplaySummary;
  score?: number;
  reasons?: string[];
  medal?: string | null;
  publicId?: string;
}

/** A stored replay by its id. */
export interface Stored {
  id: string;
  doc: GalleryReplay;
}

/**
 * The human seats' uids, left first: a local match's player, an online
 * match's host and guest - null when the room does not name two distinct
 * accounts who both reported.
 */
export function humansOf(doc: GalleryReplay): string[] | null {
  if (doc.kind !== 'online') {
    const player = doc.players[0];
    return player === undefined ? null : [player];
  }
  const [host, guest] = doc.seats ?? [];
  return typeof host === 'string' &&
    typeof guest === 'string' &&
    host !== guest &&
    doc.players.includes(host) &&
    doc.players.includes(guest)
    ? [host, guest]
    : null;
}

/**
 * What the replay alone decides, checked before any account is looked up:
 * a local match `submitted` or an online one `agreed` - or one the boards
 * verified already - on the current balance and at most 6 minutes long;
 * no ranked attempt the boards have still to check, nobody took it down,
 * not public yet, and its human seats known.
 */
export function fitsGallery(doc: GalleryReplay): boolean {
  const stateFits =
    doc.state === 'verified' ||
    (doc.kind === 'online'
      ? doc.state === 'agreed'
      : doc.state === 'submitted' && doc.attempt === undefined);
  return (
    stateFits &&
    doc.balanceVersion === BALANCE_VERSION &&
    doc.ticks <= MAX_GALLERY_TICKS &&
    doc.optOut.length === 0 &&
    doc.galleryOut !== true &&
    doc.stubExpired !== true &&
    doc.publicId === undefined &&
    humansOf(doc) !== null
  );
}

/**
 * True for a replay the gallery may take: it fits ({@link fitsGallery}),
 * and every human seat is on a Google account at least 7 days old that
 * keeps its matches in the gallery.
 */
export function isCandidate(
  doc: GalleryReplay,
  accounts: ReadonlyMap<string, AccountInfo>,
  optedOut: ReadonlySet<string>,
  now: number
): boolean {
  return (
    fitsGallery(doc) &&
    (humansOf(doc) ?? []).every((uid) => {
      const account = accounts.get(uid);
      return (
        account !== undefined &&
        account.google &&
        account.createdAt !== null &&
        now - account.createdAt >= MIN_ACCOUNT_AGE_MS &&
        !optedOut.has(uid)
      );
    })
  );
}

/**
 * The candidates to look at: the best hints first, at most 3 per player
 * and 20 in all.
 */
export function rankCandidates(candidates: readonly Stored[]): Stored[] {
  const perPlayer = new Map<string, number>();
  const picked: Stored[] = [];
  const byHint = [...candidates].sort(
    (a, b) => b.doc.hint - a.doc.hint || a.id.localeCompare(b.id)
  );
  for (const candidate of byHint) {
    const players = humansOf(candidate.doc) ?? [];
    if (players.some((uid) => (perPlayer.get(uid) ?? 0) >= MAX_PER_PLAYER)) {
      continue;
    }
    for (const uid of players) {
      perPlayer.set(uid, (perPlayer.get(uid) ?? 0) + 1);
    }
    picked.push(candidate);
    if (picked.length >= MAX_CANDIDATES) {
      break;
    }
  }
  return picked;
}

/**
 * The verified replays to publish: scoring at least 60, online matches
 * first, then the best scores; at most ten, one per player and two per
 * level.
 */
export function pickPublished(verified: readonly Stored[]): string[] {
  const perLevel = new Map<string, number>();
  const players = new Set<string>();
  const picked: string[] = [];
  const order = verified
    .filter(({ doc }) => (doc.score ?? 0) >= MIN_SCORE)
    .sort(
      (a, b) =>
        Number(b.doc.kind === 'online') - Number(a.doc.kind === 'online') ||
        (b.doc.score ?? 0) - (a.doc.score ?? 0) ||
        b.doc.hint - a.doc.hint
    );
  for (const { id, doc } of order) {
    const humans = humansOf(doc) ?? [];
    if (
      picked.length >= MAX_PUBLISHED ||
      humans.some((uid) => players.has(uid)) ||
      (perLevel.get(doc.levelId) ?? 0) >= MAX_PER_LEVEL
    ) {
      continue;
    }
    for (const uid of humans) {
      players.add(uid);
    }
    perLevel.set(doc.levelId, (perLevel.get(doc.levelId) ?? 0) + 1);
    picked.push(id);
  }
  return picked;
}
