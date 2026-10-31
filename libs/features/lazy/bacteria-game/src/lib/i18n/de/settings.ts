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
    ambience: 'Blasen und Nebel in der Schale',
    adaptiveQuality: 'Schärfe ans Gerät anpassen',
    adaptiveQualityNote:
      'Kommen die Bilder zu langsam, wird die Arena mit weniger Pixeln gezeichnet.',
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
  matches: {
    title: 'Matches',
    recordLocal: 'Matches gegen den Computer aufzeichnen',
    recordLocalNote:
      'Mit „Meine Matches speichern“ werden sie in „Meine Matches“ aufbewahrt: 30 Tage in der Cloud oder, ohne Cloud, auf diesem Gerät.',
    saveMatches: 'Meine Matches speichern',
    saveMatchesNote: 'Online-Matches werden immer aufbewahrt.',
  },
  privacy: {
    title: 'Datenschutz',
    stats: 'Nutzungsstatistik',
    statsNote:
      'Zählt mit Google Analytics, welche Modi, Level und Bildschirme gespielt werden, um das Spiel besser zu machen. Nichts, was dich nennt, keine Werbung. Was genau, steht in der Datenschutzerklärung.',
  },
  simulation: {
    choice: 'Simulation',
    auto: 'Automatisch',
    gpu: 'GPU',
    cpuChoice: 'CPU',
    gpuInt: 'Partien laufen auf der GPU, auf jedem Gerät gleich.',
    cpu: 'Partien laufen auf der CPU.',
    forced:
      'Für dieses Gerät gewählt – Automatisch lässt wieder das Spiel entscheiden.',
    passed: 'GPU-Selbsttest auf {renderer} bestanden.',
    software:
      'GPU-Selbsttest auf {renderer} bestanden, doch der zeichnet auf der CPU - zu langsam für Partien auf der GPU.',
    failedAt: 'GPU-Selbsttest auf {renderer} bei Tick {tick} durchgefallen.',
    error: 'GPU-Selbsttest konnte auf {renderer} nicht laufen: {error}',
    pending: 'GPU-Selbsttest noch nicht gelaufen.',
  },
  language: {
    title: 'Sprache',
    automatic: 'Automatisch',
    note: 'Automatisch folgt der Sprache des Browsers.',
  },
};
