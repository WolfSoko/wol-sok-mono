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
    public: 'Öffentlich',
    publicName: 'Meinen Namen öffentlich zeigen',
    publicNameNote:
      'In den Bestenlisten und, sobald sie öffnet, in der Match-Galerie. Standardmäßig aus: Dann sehen andere stattdessen „Anonym #1234“ und ein gezeichnetes Bakterium. Dein Name wird vor dem Zeigen geprüft.',
    boardOptOut: 'Mich aus den Bestenlisten heraushalten',
    boardOptOutNote:
      'Blendet alle deine Einträge aus. Deine Ergebnisse zählen weiter, und deine Einträge kommen zurück, wenn du das ausschaltest.',
    galleryOptOut: 'Meine Matches aus der öffentlichen Galerie heraushalten',
    galleryOptOutNote:
      'Keins deiner Matches wird dort gezeigt. Die Galerie ist noch nicht geöffnet.',
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
    deletion:
      'Ein Gastkonto wird gelöscht, wenn das Spiel {days} Tage lang nicht geöffnet wurde.',
  },
  guest: {
    title: 'Behalte deinen Fortschritt',
    welcomeBack: 'Schön, dass du wieder da bist!',
    note: 'Du spielst als Gast. Öffnest du das Spiel {days} Tage lang nicht, wird dein Gastkonto gelöscht – und mit ihm dein Fortschritt, deine Freunde und deine Plätze in den Ranglisten. Melde dich mit Google an, dann bleibt alles, auf jedem Gerät.',
    later: 'Später',
    chip: 'Anmelden',
    chipHint: 'Du spielst als Gast: mit Google anmelden',
    profile: 'Dein Profil: {name}',
    friends:
      'Deine Freunde gehören zu deinem Gastkonto. Melde dich mit Google an, damit sie bleiben.',
    boards:
      'Deine Plätze in den Ranglisten gehören zu deinem Gastkonto. Melde dich mit Google an, damit sie bleiben.',
    matches:
      'Deine gespeicherten Matches gehören zu deinem Gastkonto. Melde dich mit Google an, damit sie bleiben.',
    success:
      'Gut gespielt! Melde dich mit Google an, damit du behältst, was du dir verdient hast – auf jedem Gerät.',
  },
};
