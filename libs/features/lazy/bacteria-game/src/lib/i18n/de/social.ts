import type { Translation } from '../translation';
import type { social as en } from '../en/social';

export const social: Translation<typeof en> = {
  failed: 'Das hat nicht geklappt – versuch es noch mal.',
  avatar: 'Avatar',
  friends: {
    title: 'Freunde',
    region: 'Deine Freunde',
    intro:
      'Sieh, wer online ist, beantworte Freundschaftsanfragen und fordere Freunde zu einem Match heraus – oder lade jemand Neues ein.',
    noCloud:
      'Freunde gibt es nur mit der Cloud des Spiels – und mit der verbindet sich diese Version nicht.',
    requests: 'Freundschaftsanfragen',
    wantsToBeFriends: 'möchte mit dir befreundet sein',
    accept: 'Annehmen',
    decline: 'Ablehnen',
    none: 'Noch keine Freunde. Lade jemanden ein oder füge deinen Gegner nach einem Online-Match hinzu.',
    challenge: 'Herausfordern',
    remove: '{name} entfernen',
    invite: 'Freund einladen',
    status: {
      pending: 'Noch nicht angenommen',
      online: 'Online',
      playing: 'Spielt',
      offline: 'Offline',
    },
    statusLine: '{status} · {motto}',
    share: {
      title: 'Bacteria Wars',
      text: 'Sei mein Freund in Bacteria Wars – und tritt gegen mich an!',
    },
    copied:
      'Link kopiert – schick ihn an einen Freund. Er gilt eine Woche lang.',
  },
  notices: {
    challenges: 'fordert dich zu einem Match heraus!',
    play: 'Spielen',
    decline: 'Ablehnen',
    inviteBefore: '',
    inviteAfter: 'als Freund hinzufügen?',
    addFriend: 'Hinzufügen',
    dismiss: 'Schließen',
  },
};
