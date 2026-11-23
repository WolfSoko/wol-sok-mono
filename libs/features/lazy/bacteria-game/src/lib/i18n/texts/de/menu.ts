import type { menu as en } from '../en/menu';
import type { Translation } from '@wolsok/feat-shared-bacteria-engine';

export const menu: Translation<typeof en> = {
  tagline:
    'Steuere deine Kolonie, verschling die anderen. {levels} Schalen, jeden Tag ein neues Level, Endlos-Läufe – und Freunde, die du schlagen kannst.',
  more: 'Mehr',
  bacterium: {
    label: 'Dein Bakterium: Spielen und die Bereiche des Spiels',
  },
  gallery: 'Matches des Tages',
  admin: 'Verwaltung',
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
