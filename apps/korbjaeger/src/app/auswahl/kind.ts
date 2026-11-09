import type {
  BenannterSpieler,
  PersonId,
} from '@wolsok/feat-shared-basketball-data';

/**
 * A Kind an Elternteil marked in a Kader: the person id of a named player
 * and the optional nickname they gave it. Nothing else of the player is
 * kept (ADR 0019): its name is read fresh from the Kader that shows it.
 */
export interface Kind {
  readonly personId: PersonId;
  /** The name used at home, trimmed; absent where none was given. */
  readonly spitzname?: string;
}

/**
 * What marking takes of a player: only a named one (`BenannterSpieler`)
 * has it, so an Anonymer Spieler cannot be marked.
 */
export type MarkierbarerSpieler = Pick<BenannterSpieler, 'art' | 'personId'>;

/** How long a Spitzname may be, in characters. */
export const SPITZNAME_LAENGE = 30;

/** Tells the characters of a text as a reader sees them, an emoji as one. */
const ZEICHEN = new Intl.Segmenter('de', { granularity: 'grapheme' });

/**
 * The Spitzname to keep of `eingabe`: trimmed and cut to
 * `SPITZNAME_LAENGE` characters; none where nothing is left.
 */
export function spitznameAus(eingabe: string | undefined): string | undefined {
  const zeichen = Array.from(
    ZEICHEN.segment(eingabe?.trim() ?? ''),
    ({ segment }) => segment
  );
  const spitzname = zeichen.slice(0, SPITZNAME_LAENGE).join('').trim();
  return spitzname === '' ? undefined : spitzname;
}

/** `personId` as a Kind with `spitzname`, the field left out where none. */
export function kindMit(personId: PersonId, spitzname?: string): Kind {
  const name = spitznameAus(spitzname);
  return name === undefined ? { personId } : { personId, spitzname: name };
}
