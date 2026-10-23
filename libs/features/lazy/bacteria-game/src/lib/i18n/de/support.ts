import type { support as en } from '../en/support';
import type { Translation } from '../translation';

/** Tips and ads: the support tile, card and dialog, and the ad slot. */
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
};
