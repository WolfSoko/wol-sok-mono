import type {
  NamedPlayer,
  PersonId,
} from '@wolsok/feat-shared-basketball-data';

/**
 * A Kind an Elternteil marked in a Kader: the person id of a named player
 * and the optional nickname they gave it. Nothing else of the player is
 * kept (ADR 0019): its name is read fresh from the Kader that shows it.
 */
export interface Child {
  readonly personId: PersonId;
  /** The name used at home, trimmed; absent where none was given. */
  readonly nickname?: string;
}

/**
 * What marking takes of a player: only a named one (`NamedPlayer`)
 * has it, so an Anonymer Spieler cannot be marked.
 */
export type MarkablePlayer = Pick<NamedPlayer, 'kind' | 'personId'>;

/** How long a Spitzname may be, in characters. */
export const NICKNAME_LENGTH = 30;

/**
 * How long a Spitzname may be in code points: the Firestore rules' cap
 * (`firestore.rules`, whose spec takes this number). 30 of the longest
 * emoji (a family with skin tones, 11 code points) fit.
 */
export const NICKNAME_CODE_POINTS = 330;

/** Tells the characters of a text as a reader sees them, an emoji as one. */
const GRAPHEMES = new Intl.Segmenter('de', { granularity: 'grapheme' });

/** The characters of `text` as a reader sees them, an emoji as one. */
function charactersOf(text: string): readonly string[] {
  return Array.from(GRAPHEMES.segment(text), ({ segment }) => segment);
}

/**
 * How many characters of `input` count towards `NICKNAME_LENGTH`: the
 * trimmed text's, an emoji as one, as `nicknameOf` counts them.
 */
export function nicknameCharacterCount(input: string): number {
  return charactersOf(input.trim()).length;
}

/**
 * The Spitzname to keep of `input`: trimmed and cut to
 * `NICKNAME_LENGTH` characters (`nicknameCharacterCount`), and to whole
 * characters within `NICKNAME_CODE_POINTS`; none where nothing is left.
 */
export function nicknameOf(input: string | undefined): string | undefined {
  let codePoints = 0;
  const kept: string[] = [];
  for (const character of charactersOf(input?.trim() ?? '').slice(
    0,
    NICKNAME_LENGTH
  )) {
    codePoints += codePointsOf(character);
    if (codePoints > NICKNAME_CODE_POINTS) {
      break;
    }
    kept.push(character);
  }
  const nickname = kept.join('').trim();
  return nickname === '' ? undefined : nickname;
}

/**
 * How many code points `text` has, as the Firestore rules count it (an
 * emoji of a family is several): unlike its characters (`nicknameCharacterCount`).
 */
export function codePointsOf(text: string): number {
  let count = 0;
  for (const _codePoint of text) {
    count++;
  }
  return count;
}

/** `personId` as a Kind with `nickname`, the field left out where none. */
export function childWith(personId: PersonId, nickname?: string): Child {
  const name = nicknameOf(nickname);
  return name === undefined ? { personId } : { personId, nickname: name };
}
