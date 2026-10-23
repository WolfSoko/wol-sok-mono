import type { menu as en } from '../en/menu';
import type { Translation } from '../translation';

export const menu: Translation<typeof en> = {
  tagline:
    'Steuere deine Kolonie, verschling die anderen. {levels} Schalen, jeden Tag ein neues Level, Endlos-Läufe – und Freunde, die du schlagen kannst.',
  newGameNote: 'Kampagne, Tageslevel, Endlos, Frei, Zwei Spieler, Online',
  more: 'Mehr',
  friendRequests: {
    one: '{count} Freundschaftsanfrage',
    other: '{count} Freundschaftsanfragen',
  },
  card: {
    label: 'Deine Kampagne',
    campaign: 'Kampagne',
    levelsOpen: 'von {total} Levels offen',
    levelsOpenBar: 'Offene Levels',
    medals: 'Medaillen',
    achievements: 'Erfolge',
    continue: 'Kampagne fortsetzen',
  },
};
