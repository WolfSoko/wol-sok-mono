import type { Translation } from '@wolsok/feat-lazy-bac-game/admin-kit';
import type { EN } from './en';

/** The admin area's German texts - the same keys as {@link EN}. */
export const DE: Translation<typeof EN> = {
  title: 'Bacteria Wars Verwaltung',
  nav: {
    overview: 'Übersicht',
  },
  gate: {
    checking: 'Zugang wird geprüft…',
    signedOut: 'Melde dich mit dem Google-Konto des Betreibers an.',
    signIn: 'Mit Google anmelden',
    noAccess: 'Dieses Konto hat keinen Zugang zur Verwaltung.',
    signOut: 'Abmelden',
    failed: 'Die Anmeldung hat nicht geklappt. Versuch es noch einmal.',
    noProject: 'Für diesen Build ist kein Firebase-Projekt eingerichtet.',
  },
  command: {
    sent: 'Gesendet - der Server arbeitet…',
    done: 'Erledigt.',
    failed: 'Der Server hat abgelehnt: {error}',
    signInAgain:
      'Dafür muss die Anmeldung jünger als eine Stunde sein. Melde dich neu an und versuch es noch einmal.',
  },
  overview: {
    refresh: 'Aktualisieren',
    updated: 'Stand {at}',
    never: 'Noch keine Statistik - aktualisieren, um sie zu berechnen.',
    players: 'Spieler',
    matches: 'Partien',
    replays: 'Wiederholungen',
    moderation: 'Moderation',
    boards: 'Einträge auf den Bestenlisten',
    today: 'Heute',
    history: 'Die letzten 48 Stunden',
    hour: 'Stunde (UTC)',
    figure: {
      accounts: 'Konten',
      active24h: 'Aktiv (24 h)',
      active7d: 'Aktiv (7 Tage)',
      online: 'Gerade online',
      playing: 'In einer Partie',
      searching: 'Suchen einen Gegner',
      roomsOpen: 'Offene Räume',
      matchesRunning: 'Laufende Partien',
      replays: 'Gespeichert',
      replaysToday: 'Heute gespeichert',
      submissionsWaiting: 'Warten auf den Upload',
      bans: 'Aktive Sperren',
      uploadedPictures: 'Hochgeladene Bilder',
    },
  },
};
