import type { Translation } from '../translation';
import type { online as en } from '../en/online';

export const online: Translation<typeof en> = {
  noCloud:
    'Online-Matches gibt es nur mit der Cloud des Spiels – und mit der verbindet sich diese Version nicht.',
  searching: 'Suche einen Gegner …',
  find: 'Gegner finden',
  matchmakingPaused:
    'Zufällige Matches sind gerade pausiert. Spiel stattdessen mit Code gegen einen Freund.',
  level: 'Level',
  anyLevel: 'Beliebiges Level',
  levelPicked: {
    yours: 'Level: {level} (deine Wahl)',
    theirs: 'Level: {level} (Wahl deines Gegners)',
    random: 'Level: {level} (zufällig)',
  },
  withCode: 'Mit Code spielen',
  withCodeText:
    'Eröffne ein Match und schick den Code an einen Freund – oder gib seinen ein.',
  open: 'Match eröffnen',
  codeField: 'Code von einem Freund',
  join: 'Beitreten',
  found: 'Gegner gefunden – das Match wird eröffnet …',
  opening: 'Match wird eröffnet …',
  waitingFor: 'Warte, bis {name} annimmt …',
  sendCode: 'Schick deinem Freund diesen Code',
  waitingToJoin: 'Warte, bis dein Freund beitritt …',
  connecting: 'Verbinde mit deinem Gegner …',
  connectedTo: 'Verbunden mit {name} – du spielst {colony}.',
  connected: 'Verbunden – du spielst {colony}.',
  hostPicks: 'Du wählst das Level und startest die Matches.',
  guestFollows: 'Dein Gegner wählt das Level und startet die Matches.',
  leave: 'Verlassen',
  left: 'Links',
  right: 'Rechts',
  notices: {
    badCode: 'Ein Code hat sechs Buchstaben und Ziffern.',
    noRoom: 'Unter diesem Code ist kein Match offen.',
    taken: 'Jemand anderes ist dem Match schon beigetreten.',
    opponentLeft: 'Dein Gegner ist gegangen.',
    otherVersion:
      'Dein Gegner spielt eine andere Version des Spiels – ladet beide das Spiel neu.',
    lost: 'Die Verbindung zu deinem Gegner ist abgebrochen.',
    failed:
      'Keine Verbindung möglich. Versuch es noch mal – im selben WLAN klappt es am besten.',
  },
};
