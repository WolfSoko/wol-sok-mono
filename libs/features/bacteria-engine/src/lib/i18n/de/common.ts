import type { Translation } from '../translation';
import type { common as en } from '../en/common';

export const common: Translation<typeof en> = {
  menu: 'Menü',
  back: 'Zurück',
  cancel: 'Abbrechen',
  mute: 'Ton aus',
  unmute: 'Ton an',
  fullscreen: 'Vollbild',
  exitFullscreen: 'Vollbild beenden',
  withKey: '{label} ({key})',
  of: 'von {total}',
  // One word with the metal: "Goldmedaille", "Platinmedaille".
  medal: '{medal}medaille',
  noMedal: 'Noch keine Medaille',
  series: 'Serie',
  rivalry: 'Rivalität',
};
