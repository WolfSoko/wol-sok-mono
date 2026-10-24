import type { Translation } from '../translation';
import type { settings as en } from '../en/settings';

export const settings: Translation<typeof en> = {
  title: 'Einstellungen',
  display: {
    title: 'Darstellung',
    arena: 'Arena',
    ownArena: 'Jedes Level seine eigene',
    simResolution: 'Simulationsauflösung',
    simResolutions: {
      low: 'Niedrig',
      normal: 'Normal',
      high: 'Hoch',
      ultra: 'Ultra',
    },
    cells: '{width} × {height} Zellen',
    vaporize: 'Verdampfen',
    vaporizeQualities: {
      off: 'Aus',
      low: 'Niedrig',
      medium: 'Mittel',
      full: 'Voll',
    },
    vaporizeDuration: 'Dauer des Verdampfens',
    vaporizeDurations: {
      short: 'Kurz',
      normal: 'Normal',
      long: 'Lang',
    },
    screenResolution: 'Bildschirmauflösung',
    locked:
      'Farben und Auflösungen wählst du vor einem Match – solange eines läuft, bleiben sie, wie sie sind.',
  },
  sound: {
    title: 'Ton',
    sound: 'Ton',
    music: 'Musik',
    musicVolume: 'Musiklautstärke',
    effects: 'Soundeffekte',
    effectsVolume: 'Effektlautstärke',
    vibration: 'Vibration',
    vibrationNote:
      'Ein Summen für einen Boost, ein Rums für ein Tor, ein Tusch für eine Medaille.',
  },
  screen: {
    title: 'Bildschirm',
    showFps: 'Bildrate anzeigen',
    fullscreen: 'Browser-Vollbild',
  },
  language: {
    title: 'Sprache',
    automatic: 'Automatisch',
    note: 'Automatisch folgt der Sprache des Browsers.',
  },
};
