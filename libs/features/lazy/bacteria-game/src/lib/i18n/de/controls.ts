import type { controls as en } from '../en/controls';
import type { Translation } from '../translation';

export const controls: Translation<typeof en> = {
  joystick: 'Joystick {name}',
  boost: {
    ready: 'Boost',
    boosting: 'Boost läuft',
    cooldown: '{seconds} s',
    button: 'Boost für {name}',
    recharge: 'Boost lädt auf',
  },
  weaponKeys: {
    before: 'Im Match gegen den Computer feuert',
    e: 'E',
    or: 'oder die',
    shift: 'rechte Umschalttaste',
    after: 'deine Waffe ab.',
  },
  colors: {
    left: 'Linker Spieler',
    right: 'Rechter Spieler',
    group: 'Farbe: {seat}',
    locked: '{color}, gesperrt: {lock}',
    lockedTip: '{color} – {lock}',
    toEarn: 'Farben zum Freischalten',
  },
};
