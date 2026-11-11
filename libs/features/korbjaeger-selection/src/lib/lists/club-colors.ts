import type { ClubId } from '@wolsok/feat-shared-basketball-data';
import {
  REMOVED,
  entriesWith,
  idOfKey,
  isMap,
  type ReadEntry,
} from '../selection-entries';
import type { ListDescriptor } from '../list-descriptor';
import { sameColors } from '../club-colors';
import {
  colorsFromText,
  colorsText,
  byClub,
  type ClubColorsChoice,
} from '../club-colors-choice';

/** What a change writes of a Verein's colours: their text, or that they go. */
export type ClubColorsField = string | typeof REMOVED;

/**
 * The Vereine's colours, stored as `clubColors: { [vereinId]: farbenText }`,
 * a Verein without any having no entry; kept in the order of the Verein's
 * id. An entry it cannot read is left out.
 */
export const CLUB_COLORS: ListDescriptor<
  ClubColorsChoice,
  ClubColorsField,
  'clubColors'
> = {
  field: 'clubColors',
  id: (choice) => choice.clubId,
  equals: (a, b) => a.clubId === b.clubId && sameColors(a, b),
  read: (raw) => {
    if (!isMap(raw)) {
      return [];
    }
    const colors: ClubColorsChoice[] = [];
    for (const [key, text] of Object.entries(raw)) {
      const clubId: ClubId | undefined = idOfKey(key);
      const parsed = colorsFromText(text);
      if (clubId !== undefined && parsed) {
        colors.push({ clubId, ...parsed });
      }
    }
    // ordered by Verein (`order`), so its entries carry no `since`
    return byClub(colors).map((value): ReadEntry<ClubColorsChoice> => ({
      value,
    }));
  },
  added: (choice) => colorsText(choice),
  changed: (_previous, current) => colorsText(current),
  merge: entriesWith,
  order: byClub,
};
