import type { Translation } from '../translation';
import type { profile as en } from '../en/profile';

export const profile: Translation<typeof en> = {
  title: 'Profil',
  online: 'Online-Profil',
  summary: 'Rang und Bilanz',
  ranks: 'Ränge',
  figures: {
    levelsWon: 'Level gewonnen',
    medallions: 'Medaillen',
    matchesWon: 'Matches gewonnen',
    captured: 'Bakterien übernommen',
    crushed: 'Von Wänden zerdrückt',
    couchMatches: 'Matches zu zweit',
  },
  tally: 'Medaillen nach Metall',
  achievements: {
    title: 'Erfolge',
    earned: 'Freigeschaltet am {date}',
  },
  cabinet: {
    title: 'Medaillen',
    level: 'Level',
  },
  editor: {
    name: 'Name',
    motto: 'Motto',
    picture: 'Bild',
    preset: 'Bakterium {number}',
    googlePhoto: 'Google-Foto',
    upload: 'Bild hochladen',
    shareStatus: 'Freunde sehen, wenn ich online bin',
    save: 'Speichern',
    saved: 'Gespeichert.',
    unreadable: 'Das Bild ließ sich nicht lesen – versuch ein anderes.',
  },
  account: {
    local: 'Auf diesem Gerät gespeichert',
    connecting: 'Verbinde …',
    guest: 'Du spielst als Gast',
    signIn: 'Mit Google anmelden',
    signInHint:
      'Behalte deinen Fortschritt auf jedem Gerät, auf dem du dich anmeldest',
    signedInAs: 'Angemeldet als',
    googleUser: 'Google-Nutzer',
    signOut: 'Abmelden',
  },
};
