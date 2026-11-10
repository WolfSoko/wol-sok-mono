import type { TeamId } from '@wolsok/feat-shared-basketball-data';
import {
  ENTFERNT,
  eintraegeMit,
  idAus,
  istKarte,
  istZahl,
  bySince,
  type EntrySince,
} from '../selection-entries';
import type { ListDescriptor } from '../list-descriptor';

/** What a change writes of a Team: since when it is followed, or that it goes. */
export type TeamFeld = number | typeof ENTFERNT;

/**
 * Meine Teams, stored as `teams: { [teamId]: seit }`, in the order they
 * were followed. A map holding anything but ids and numbers makes the whole
 * document unreadable; a missing one holds no Teams.
 */
export const TEAMS: ListDescriptor<TeamId, TeamFeld, 'teams'> = {
  field: 'teams',
  id: (team) => team,
  equals: (a, b) => a === b,
  read: (raw) => {
    if (raw === undefined) {
      return [];
    }
    if (!istKarte(raw)) {
      return undefined;
    }
    const entries: EntrySince<TeamId>[] = [];
    for (const [key, since] of Object.entries(raw)) {
      const team = idAus(key);
      if (team === undefined || !istZahl(since)) {
        return undefined;
      }
      entries.push({ value: team, since });
    }
    return bySince(entries, (team) => team);
  },
  added: (_team, since) => since(),
  merge: eintraegeMit,
};
