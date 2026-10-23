import type { site as en } from '../en/site';
import type { Translation } from '../translation';

/** The game's own site: the offer to install it, and the legal lines under the menu. */
export const site: Translation<typeof en> = {
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
