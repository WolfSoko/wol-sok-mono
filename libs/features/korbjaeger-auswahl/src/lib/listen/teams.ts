import type { TeamId } from '@wolsok/feat-shared-basketball-data';
import {
  ENTFERNT,
  eintraegeMit,
  idAus,
  istKarte,
  istZahl,
  nachSeit,
  type GelesenerEintrag,
} from '../auswahl-eintraege';
import type { AuswahlListenArt } from '../auswahl-liste';

/** What a change writes of a Team: since when it is followed, or that it goes. */
export type TeamFeld = number | typeof ENTFERNT;

/**
 * Meine Teams, stored as `teams: { [teamId]: seit }`, in the order they
 * were followed. A map holding anything but ids and numbers makes the whole
 * document unreadable; a missing one holds no Teams.
 */
export const TEAMS: AuswahlListenArt<TeamId, TeamFeld, 'teams'> = {
  feld: 'teams',
  id: (team) => team,
  gleich: (a, b) => a === b,
  lesen: (roh) => {
    if (roh === undefined) {
      return [];
    }
    if (!istKarte(roh)) {
      return undefined;
    }
    const eintraege: GelesenerEintrag<TeamId>[] = [];
    for (const [schluessel, seit] of Object.entries(roh)) {
      const team = idAus(schluessel);
      if (team === undefined || !istZahl(seit)) {
        return undefined;
      }
      eintraege.push({ wert: team, seit });
    }
    return nachSeit(eintraege, (team) => team);
  },
  neu: (_team, seit) => seit(),
  mit: eintraegeMit,
  // a Team followed again at its old place (`folgenAenderung`)
  bekannterSeit: (inhalt, team) => inhalt.teamsSeit?.get(team),
};
