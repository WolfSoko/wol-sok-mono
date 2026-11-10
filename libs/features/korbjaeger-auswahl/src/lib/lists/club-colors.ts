import type { VereinId } from '@wolsok/feat-shared-basketball-data';
import {
  ENTFERNT,
  eintraegeMit,
  idAus,
  istKarte,
  type ReadEntry,
} from '../selection-entries';
import type { ListDescriptor } from '../list-descriptor';
import { gleicheFarben } from '../vereinsfarben';
import {
  farbenAusText,
  farbenText,
  nachVerein,
  type VereinsfarbenWahl,
} from '../vereinsfarben-wahl';

/** What a change writes of a Verein's colours: their text, or that they go. */
export type VereinsfarbenFeld = string | typeof ENTFERNT;

/**
 * The Vereine's colours, stored as `clubColors: { [vereinId]: farbenText }`,
 * a Verein without any having no entry; kept in the order of the Verein's
 * id. An entry it cannot read is left out.
 */
export const CLUB_COLORS: ListDescriptor<
  VereinsfarbenWahl,
  VereinsfarbenFeld,
  'clubColors'
> = {
  field: 'clubColors',
  orderedBySince: false,
  id: (wahl) => wahl.vereinId,
  equals: (a, b) => a.vereinId === b.vereinId && gleicheFarben(a, b),
  read: (raw) => {
    if (!istKarte(raw)) {
      return [];
    }
    const colors: VereinsfarbenWahl[] = [];
    for (const [key, text] of Object.entries(raw)) {
      const vereinId: VereinId | undefined = idAus(key);
      const farben = farbenAusText(text);
      if (vereinId !== undefined && farben) {
        colors.push({ vereinId, ...farben });
      }
    }
    // ordered by Verein, not by `seit` (`orderedBySince: false`)
    return nachVerein(colors).map((value): ReadEntry<VereinsfarbenWahl> => ({
      value,
      since: 0,
    }));
  },
  added: (wahl) => farbenText(wahl),
  changed: (_alt, current) => farbenText(current),
  merge: eintraegeMit,
  order: nachVerein,
};
