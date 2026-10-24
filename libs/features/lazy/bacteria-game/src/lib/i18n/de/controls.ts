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
    share: 'Anteil an allen Bakterien',
  },
  weaponKeys: {
    leftFires: '{name} feuert die Waffe mit',
    rightFires: '{name} mit der',
    e: 'E',
    shift: 'rechten Umschalttaste',
    both: 'Gegen den Computer feuert jede der beiden deine.',
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
