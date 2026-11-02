import type { support as en } from '../en/support';
import type { Translation } from '../translation';

/** Tips and ads, the offer to install the game, the legal lines under the menu. */
export const support: Translation<typeof en> = {
  tile: 'Unterstützen',
  title: 'Unterstütze das Spiel',
  dialogTitle: 'Unterstütze Bacteria Wars',
  pitch:
    'Das Spiel ist kostenlos und in meiner Freizeit entstanden. Wenn es dir gute Kämpfe liefert, hält ein Kaffee die Server am Laufen und bringt neue Levels.',
  buyCoffee: 'Spendier mir einen Kaffee',
  thanks: 'Danke für den Kaffee!',
  failed: 'Der Kauf hat nicht geklappt. Bitte versuch es noch einmal.',
  close: 'Schließen',
  ad: 'Anzeige',
  adSettings: 'Datenschutz-Einstellungen für Anzeigen',
  stats: {
    title: 'Hilf, das Spiel besser zu machen',
    note: 'Darf das Spiel mit Google Analytics zählen, welche Modi, Level und Bildschirme gespielt werden? Nichts, was dich nennt, keine Werbung. Ändern kannst du das jederzeit in den Einstellungen.',
    allow: 'Erlauben',
    decline: 'Nein danke',
  },
  install: {
    title: 'Spiel Bacteria Wars als App',
    android:
      'Im Vollbild, offline und direkt vom Startbildschirm: Hol dir die App bei Google Play oder installiere diese Web-App.',
    ios: 'Im Vollbild, offline und direkt vom Startbildschirm: Tippe auf Teilen und dann auf „Zum Home-Bildschirm“.',
    other:
      'Im Vollbild, offline und direkt vom Desktop: Installiere die Web-App.',
    playStore: 'Bei Google Play laden',
    webApp: 'Web-App installieren',
    dismiss: 'Später',
  },
  footer: {
    label: 'Rechtliches',
    privacy: 'Datenschutz',
    legalNotice: 'Impressum',
  },
};
