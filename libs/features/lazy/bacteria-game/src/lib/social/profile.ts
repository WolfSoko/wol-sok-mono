import { isObject } from '../state/is-object';

/** The avatars the game draws: a bacterium per id - see `avatar-art.ts`. */
export const AVATAR_COUNT = 12;

/** A player's picture. */
export type Avatar =
  /** One of the bacteria the game draws, by number. */
  | { kind: 'preset'; id: number }
  /** The photo of the player's Google account. */
  | { kind: 'photo'; url: string }
  /** An image the player uploaded, scaled down, as a data URL. */
  | { kind: 'image'; data: string };

/** What others see of a player. */
export interface PlayerCard {
  name: string;
  motto: string;
  avatar: Avatar;
}

/** A player's own profile: their card and what they share. */
export interface Profile extends PlayerCard {
  /** True when friends may see that the player is online. */
  shareStatus: boolean;
}

export const NAME_MAX = 24;
export const MOTTO_MAX = 80;
/** The longest uploaded image, as a data URL - a 96 px WebP is a few KB. */
export const IMAGE_MAX = 40_000;
const PHOTO_MAX = 500;

/** A fresh player's profile: a name from their uid, an avatar from it too. */
export function defaultProfile(
  uid: string,
  name: string | null = null
): Profile {
  const hash = hashOf(uid);
  return {
    name:
      cleanName(name ?? '') ??
      `Player ${String(hash % 10000).padStart(4, '0')}`,
    motto: '',
    avatar: { kind: 'preset', id: hash % AVATAR_COUNT },
    shareStatus: true,
  };
}

/** A name as it may be kept: trimmed, single spaces, short - null if empty. */
export function cleanName(name: string): string | null {
  const clean = name.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
  return clean === '' ? null : clean;
}

/** A motto as it may be kept: trimmed, single spaces, short. */
export function cleanMotto(motto: string): string {
  return motto.replace(/\s+/g, ' ').trim().slice(0, MOTTO_MAX);
}

/**
 * Reads a stored profile - null when there is none or it is unreadable.
 * Whatever is damaged falls back to the default of `uid`.
 */
export function parseProfile(value: unknown, uid: string): Profile | null {
  if (!isObject(value)) {
    return null;
  }
  const fallback = defaultProfile(uid);
  const name =
    typeof value['name'] === 'string' ? cleanName(value['name']) : null;
  return {
    name: name ?? fallback.name,
    motto: typeof value['motto'] === 'string' ? cleanMotto(value['motto']) : '',
    avatar: parseAvatar(value['avatar']) ?? fallback.avatar,
    shareStatus: value['shareStatus'] !== false,
  };
}

/** Reads a stored avatar - null for anything that is not one. */
export function parseAvatar(value: unknown): Avatar | null {
  if (!isObject(value)) {
    return null;
  }
  switch (value['kind']) {
    case 'preset': {
      const id = value['id'];
      return Number.isInteger(id) &&
        (id as number) >= 0 &&
        (id as number) < AVATAR_COUNT
        ? { kind: 'preset', id: id as number }
        : null;
    }
    case 'photo': {
      const url = value['url'];
      return typeof url === 'string' && isGooglePhoto(url)
        ? { kind: 'photo', url }
        : null;
    }
    case 'image': {
      const data = value['data'];
      return typeof data === 'string' && isImageData(data)
        ? { kind: 'image', data }
        : null;
    }
    default:
      return null;
  }
}

/** True for the URL of a Google account's photo - the one host allowed. */
export function isGooglePhoto(url: string): boolean {
  return (
    url.length <= PHOTO_MAX &&
    /^https:\/\/lh\d+\.googleusercontent\.com\/.+$/.test(url)
  );
}

/** True for a data URL of a WebP, PNG or JPEG image no bigger than allowed. */
export function isImageData(data: string): boolean {
  return (
    data.length <= IMAGE_MAX &&
    /^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(data)
  );
}

/** A small, stable number from a uid. */
function hashOf(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  }
  return hash >>> 0;
}
