import type { Translation } from '../translation';
import type { replay as en } from '../en/replay';

export const replay: Translation<typeof en> = {
  watch: 'Wiederholung ansehen',
  status: {
    uploading: 'Wiederholung wird gespeichert …',
    saved: 'Wiederholung in „Meine Matches“ gespeichert, für 30 Tage',
    savedDevice: 'Wiederholung auf diesem Gerät behalten, in „Meine Matches“',
    notSaved:
      'Wiederholung nicht gespeichert: „Meine Matches speichern“ ist aus. Du kannst sie bis zum nächsten Match ansehen.',
    unconfirmed:
      'Ob die Wiederholung gespeichert wurde, ließ sich nicht bestätigen. Schau später in „Meine Matches“ nach.',
    recordingHint:
      'Matches gegen den Computer werden so gespeichert. Ausschalten kannst du das unter Einstellungen → Matches.',
  },
  matches: {
    title: 'Meine Matches',
    region: 'Deine aufgezeichneten Matches',
    intro:
      'Deine aufgezeichneten Matches der letzten 30 Tage, die neuesten zuerst. Ansehen können sie nur die Spieler des Matches. Löschst du eines, verschwindet es aus deiner Liste und bleibt nur ohne dein Konto für die Statistik, bis seine 30 Tage um sind.',
    device:
      'Deine aufgezeichneten Matches bleiben auf diesem Gerät – nur die neuesten 20 werden behalten. Ohne das Online-Spiel wird nichts geprüft oder gewertet.',
    none: 'Noch keine aufgezeichneten Matches. Spiel eins – es erscheint hier, sobald es gespeichert ist.',
    loading: 'Wiederholung wird geladen …',
    older:
      'Mit einer älteren Version aufgezeichnet – sie lässt sich nicht mehr abspielen.',
    unreadable: 'Diese Wiederholung konnte nicht geladen werden.',
    watch: '{level} ansehen',
    remove: '{level} löschen',
    confirmRemove: 'Zum Löschen noch einmal tippen',
    keepOut: '{level} aus der öffentlichen Galerie heraushalten',
    removed: 'Match gelöscht.',
    keptOut: 'Dieses Match bleibt aus der öffentlichen Galerie heraus.',
    removeFailed: 'Das hat nicht geklappt. Versuch es später noch einmal.',
    stillRanking:
      'Dieses Match lässt sich löschen, sobald die Bestenliste es gezählt hat. Versuch es später noch einmal.',
    list: 'Zurück zur Liste',
    result: {
      won: 'Gewonnen',
      lost: 'Verloren',
      draw: 'Unentschieden',
    },
    kind: {
      online: 'Online',
      computer: 'Gegen den Computer',
      daily: 'Tageslevel',
      endless: 'Endlos-Lauf',
    },
    state: {
      verified: 'Bestätigt',
      unverified: 'Nicht bestätigt',
      agreed: 'Beide gemeldet',
      disputed: 'Berichte weichen ab',
      waiting: 'Ein Bericht',
    },
    counted: 'Gezählt',
    notCounted: 'Nicht gezählt: {reason}',
    galleryOut: 'Nicht in der Galerie',
    public: 'In der Galerie',
  },
  reasons: {
    arrival: {
      ruleset:
        'nicht mit dem Regelwerk gespielt, das gewertete Matches verlangen',
      seed: 'nicht das Match, für das der Versuch angemeldet war',
      'plan-mismatch': 'nicht der Aufbau gewerteter Matches',
      level: 'nicht das Level des Versuchs',
      early: 'gespielt, bevor der Versuch angemeldet war',
      late: 'nach der Frist hochgeladen',
      banned: 'ein gesperrter Spieler hat es gespielt',
      'no-attempt': 'der Versuch ist unbekannt',
      void: 'der Versuch wurde verworfen – er kostet dich nichts',
      duplicate: 'eine andere Wiederholung hat den Versuch schon genutzt',
      unreadable: 'der Versuch ließ sich nicht lesen',
    },
    online: {
      desync: 'die beiden Geräte sind aus dem Takt geraten',
      short: 'kürzer als 30 Sekunden',
      'stub-expired': 'der Raum war abgelaufen, oder ein Spieler ist weg',
      banned: 'ein gesperrter Spieler hat mitgespielt',
      'too-fast':
        'schneller gemeldet, als der Raum seine Matches spielen konnte',
      'pair-cap':
        'die gezählten Matches von heute gegen diesen Gegner sind verbraucht',
      'not-reported': 'nur ein Gerät hat es gemeldet',
    },
  },
  viewer: {
    title: 'Wiederholung',
    speed: 'Tempo: {speed}×',
    startOver: 'Von vorn',
    over: 'Ende der Wiederholung',
    play: 'Abspielen',
    pause: 'Pause',
  },
  watchPage: {
    title: 'Ansehen: {level} - Bacteria Wars',
    description:
      'Ein ausgewähltes Bacteria-Wars-Match, im Browser noch einmal abgespielt.',
    heading: 'Ausgewähltes Match: {level}',
    loading: 'Das Match wird geladen …',
    notFound: 'Unter dieser Adresse gibt es kein öffentliches Match.',
    removed: 'Dieses Match wurde entfernt.',
    unreadable: 'Dieses Match ließ sich nicht laden.',
    offline:
      'Das Match ließ sich nicht abrufen. Prüf die Verbindung und lade neu.',
    canvas: 'Das Match auf {level}, noch einmal abgespielt',
    gallery: 'Alle ausgewählten Matches',
    details: 'Zu diesem Match',
    game: 'Bacteria Wars spielen',
  },
};
