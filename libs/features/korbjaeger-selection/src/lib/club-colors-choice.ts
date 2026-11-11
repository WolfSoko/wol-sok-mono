import type { ClubId } from '@wolsok/feat-shared-basketball-data';
import { isColor, type ClubColors } from './club-colors';

/** A Verein's colours, as the `Selection` holds them: by the Verein's DBB id. */
export interface ClubColorsChoice extends ClubColors {
  readonly clubId: ClubId;
}

/** The colours `list` holds for `club`; `undefined` for none. */
export function clubColorsFor(
  list: readonly ClubColorsChoice[] | undefined,
  club: ClubId
): ClubColorsChoice | undefined {
  return list?.find(({ clubId }) => clubId === club);
}

/** The order the `Selection` keeps its Vereinsfarben in: by the Verein's id. */
export function byClub(
  list: readonly ClubColorsChoice[]
): readonly ClubColorsChoice[] {
  return [...list].sort((a, b) => a.clubId - b.clubId);
}

/**
 * How the `SelectionDocument` stores a Verein's colours: as one text,
 * `#rrggbb` or `#rrggbb,#rrggbb` with the second, so the Firestore rules
 * check every Verein's at once with one regular expression (a check per
 * entry would take more expressions than a request may evaluate).
 */
export function colorsText({ primary, secondary }: ClubColors): string {
  return secondary === undefined ? primary : `${primary},${secondary}`;
}

/** The colours `colorsText` stored in `text`; `undefined` where it is none. */
export function colorsFromText(text: unknown): ClubColors | undefined {
  if (typeof text !== 'string') {
    return undefined;
  }
  const [primary, secondary, ...rest] = text.split(',');
  return isColor(primary) &&
    (secondary === undefined || isColor(secondary)) &&
    rest.length === 0
    ? { primary, ...(secondary !== undefined && { secondary }) }
    : undefined;
}
