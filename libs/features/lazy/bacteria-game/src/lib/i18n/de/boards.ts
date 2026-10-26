import type { Translation } from '../translation';
import type { boards as en } from '../en/boards';

export const boards: Translation<typeof en> = {
  anonymous: 'Anonym #{tag}',
  title: 'Bestenlisten',
  region: 'Die Bestenlisten',
  noCloud:
    'Bestenlisten gibt es nur im Online-Spiel – und mit dem verbindet sich diese Version nicht.',
  tabs: {
    xp: 'Rang',
    online: 'Online',
    daily: 'Tageslevel',
    endless: 'Endlos',
  },
  info: {
    xp: 'Der Server berechnet die XP aus deinem gespeicherten Fortschritt, und sie steigen nicht schneller, als ein Mensch sie verdienen könnte. Dass die Matches stattfanden, beweist das nicht: Ein verändertes Spiel kann XP bis zu dieser Grenze behaupten.',
    online:
      'Ein Ergebnis zählt, wenn beide Geräte es für ein Match von mindestens 30 Sekunden gemeldet haben. Dass ehrlich gespielt wurde, beweist das nicht: Zwei Spieler, die zusammenarbeiten, können ein erfundenes Match melden, bis zu den Tagesgrenzen.',
    daily:
      'Die Top 10 hat der Server mit der Ranglisten-Einstellung nachgespielt, mit demselben Ergebnis. Dass ein Mensch spielte, ist nicht bewiesen: Auch ein Skript besteht. Einträge darunter sind Angaben, nur auf Plausibilität geprüft.',
    endless:
      'Jeden Sieg eines Laufs in den Top 10 hat der Server nachgespielt. Ein gewertetes Match, dessen Wiederholung nicht rechtzeitig ankommt, kostet ein Leben. Läufe unter den Top 10 sind Angaben.',
  },
  beingChecked: 'Wird geprüft',
  others: 'Alle anderen',
  status: {
    verified: 'Bestätigt',
    provisional: 'Vorläufig',
    stale: 'Ältere Version',
    partial: 'Teilweise bestätigt',
  },
  final: 'Endgültig',
  empty: 'Noch niemand in dieser Liste.',
  more: 'Mehr anzeigen',
  failed: 'Die Liste konnte nicht geladen werden.',
  you: {
    pos: 'Du: #{pos}',
    checking: 'Du: #{pos}, wird geprüft',
    notYet: 'Noch nicht in dieser Liste: {reason}',
    reasons: {
      none: 'noch kein gezähltes Ergebnis',
      optedOut: 'du hältst dich aus den Bestenlisten heraus (Profil)',
    },
    hidden: 'Dein Eintrag in dieser Liste ist ausgeblendet.',
  },
  day: 'Tag',
  today: 'Heute',
  newBoard: 'Neue Liste in {hours} h {minutes} min',
  show: {
    xp: '{xp} XP',
    record: 'S {w} · N {l} · U {d}',
    winRate: '{rate} gewonnen',
    notReported: 'Nicht gemeldet: {count}',
    won: 'Gewonnen in {time}',
    held: 'Gehalten {time}',
    depth: { one: '{count} Level · {time}', other: '{count} Level · {time}' },
  },
  ranked: {
    daily: 'Gewerteter Versuch',
    endless: 'Gewerteter Lauf',
    left: {
      daily: 'Gewertete Versuche heute übrig: {left} von {total}.',
      endless: 'Gewertete Läufe heute übrig: {left} von {total}.',
    },
    setup:
      'Ein gewertetes Match spielt die Wertungseinstellung - der normale Computer, kein Vorsprung - und kommt in die Bestenliste.',
    noPause:
      'Ein gewertetes Match lässt sich nicht pausieren: es muss in einem Zug zu Ende gespielt werden.',
    runLives:
      'Wer ein Match eines gewerteten Laufs verlässt, beendet den Lauf hier, und die Bestenliste zählt es als verlorenes Leben.',
    practice: 'Übung: deine eigenen Einstellungen, nicht in den Bestenlisten.',
    used: {
      daily:
        'Die drei gewerteten Versuche von heute sind verbraucht. Neue gibt es um 00:00 UTC.',
      endless:
        'Die fünf gewerteten Läufe von heute sind schon gestartet. Neue gibt es um 00:00 UTC.',
    },
    blocked: {
      device:
        'Gewertet spielen braucht einen Grafikchip, der die Prüfung des Spiels bestanden hat (Einstellungen, Bildschirm).',
      banned: 'Gewertet spielen geht nicht, solange dein Konto gesperrt ist.',
      signedOut: 'Gewertet spielen geht nur angemeldet.',
    },
    declaring: 'Dein gewerteter Versuch wird angemeldet…',
    result: {
      daily: 'Gewerteter Versuch {n} von {total} · Wertungseinstellung',
      endless: 'Gewerteter Lauf · Match {match} · Wertungseinstellung',
      offline: 'Nicht gewertet: offline, als das Match begann',
      used: 'Nicht gewertet: die drei Versuche von heute sind verbraucht',
      'runs-used':
        'Nicht gewertet: die fünf gewerteten Läufe von heute sind schon gestartet',
      'run-dropped': 'Dieser Lauf wird nicht mehr gewertet',
    },
  },
};
