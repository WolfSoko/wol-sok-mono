import {
  AVATAR_COUNT,
  boardAvatar,
  boardTag,
  posesAsLabel,
} from '@wolsok/feat-lazy-bac-game/engine';

/**
 * Words a public name may not contain, English and German (ADR 0011, 0012):
 * a short list against the obvious, matched on the name with spaces,
 * punctuation and common digit swaps taken out. A hit shows the anonymous
 * label instead; the owner hides or resets whatever slips through.
 */
const BLOCKED = [
  'arsch',
  'asshole',
  'bitch',
  'cunt',
  'faggot',
  'fick',
  'fotze',
  'fuck',
  'hitler',
  'hure',
  'kanake',
  'nazi',
  'neger',
  'nigga',
  'nigger',
  'nutte',
  'penis',
  'porn',
  'schlampe',
  'schwuchtel',
  'sieg heil',
  'shit',
  'slut',
  'whore',
  'wichser',
  'whitepower',
];

const SWAPS: Readonly<Record<string, string>> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
};

/** True for a name no board shows: blocked, or posing as a label. */
export function isBlockedName(name: string): boolean {
  if (posesAsLabel(name)) {
    return true;
  }
  const plain = name
    .toLowerCase()
    .replace(/[013457@$]/g, (char) => SWAPS[char] ?? char)
    .replace(/[^a-zäöüß]/g, '');
  return BLOCKED.some((word) => plain.includes(word.replace(/ /g, '')));
}

/** What a player's profile says about how their entries look. */
export interface BoardProfile {
  name: string;
  publicName: boolean;
  boardOptOut: boolean;
  /** Keeps all of the player's matches out of the gallery (ADR 0011). */
  galleryOptOut: boolean;
  /** The preset avatar the player shows, null for a photo or an image. */
  preset: number | null;
}

/** The profile as the boards read it - defaults for what is missing. */
export function boardProfileOf(value: unknown): BoardProfile {
  const v =
    typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)
      : {};
  const avatar =
    typeof v['avatar'] === 'object' && v['avatar'] !== null
      ? (v['avatar'] as Record<string, unknown>)
      : {};
  const preset =
    avatar['kind'] === 'preset' &&
    typeof avatar['id'] === 'number' &&
    Number.isInteger(avatar['id']) &&
    avatar['id'] >= 0 &&
    avatar['id'] < AVATAR_COUNT
      ? avatar['id']
      : null;
  return {
    name: typeof v['name'] === 'string' ? v['name'] : '',
    publicName: v['publicName'] === true,
    boardOptOut: v['boardOptOut'] === true,
    galleryOptOut: v['galleryOptOut'] === true,
    preset,
  };
}

/** How an entry is labelled: a name or the anonymous tag, and a preset. */
export interface EntryLabel {
  name: string | null;
  tag: number;
  avatar: number;
}

/**
 * An entry's label (ADR 0012): the profile's name only with `publicName`,
 * only on a counted or verified entry and only when the name is not
 * blocked; the player's own preset only with `publicName`, else one derived
 * from the entry id. Uploaded pictures and photos never appear.
 */
export function entryLabel(
  entryId: string,
  profile: BoardProfile,
  status: string
): EntryLabel {
  const named =
    profile.publicName &&
    (status === 'counted' || status === 'verified') &&
    profile.name.trim() !== '' &&
    !isBlockedName(profile.name);
  return {
    name: named ? profile.name.trim() : null,
    tag: boardTag(entryId),
    avatar:
      profile.publicName && profile.preset !== null
        ? profile.preset
        : boardAvatar(entryId),
  };
}
