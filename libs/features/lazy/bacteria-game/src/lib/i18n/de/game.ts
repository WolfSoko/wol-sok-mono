import type { game as en } from '../en/game';
import type { Translation } from '../translation';

export const game: Translation<typeof en> = {
  medals: {
    bronze: 'Bronze',
    silver: 'Silber',
    gold: 'Gold',
    platinum: 'Platin',
  },
  medalGoals: {
    bronze: 'Für Bronze brauchst du einen Sieg.',
    silver: 'Für Silber brauchst du einen Sieg in höchstens {clock}.',
    gold: 'Für Gold brauchst du einen Sieg in höchstens {clock}, bei dem du weniger als {percent} % deiner Kolonie auf ihrem Höchststand verlierst.',
    platinum:
      'Für Platin brauchst du einen Gold-Sieg ohne Boost, bei dem du nie unter {percent} % der Größe des Computers fällst.',
  },
  medalHint: 'Für {medal} fehlt {missing}.',
  medalMissing: {
    win: 'ein Sieg',
    faster: 'ein Sieg, der {seconds} s schneller ist',
    cleaner:
      'ein saubererer Sieg – Verluste unter {percent} % deiner Kolonie auf ihrem Höchststand, du hattest {had} %',
    noBoost: 'ein Gold-Sieg ohne Boost',
    bigger:
      'ein Gold-Sieg, bei dem du nie unter {percent} % der Größe des Computers fällst',
  },
  practice: {
    one: 'Dein Versuch für heute ist verbraucht – das hier war Training.',
    other:
      'Deine {count} Versuche für heute sind verbraucht – das hier war Training.',
  },
  ranks: {
    spore: 'Spore',
    coccus: 'Kokkus',
    bacillus: 'Bazillus',
    spirillum: 'Spirillum',
    biofilm: 'Biofilm',
    colony: 'Kolonie',
    culture: 'Kultur',
    superbug: 'Superkeim',
  },
  zones: {
    antibiotic: 'Antibiotikum',
    agar: 'Agar',
    ice: 'Eis',
    heat: 'Hitze',
    hill: 'Haltezone',
  },
  colors: {
    orange: 'Orange',
    blue: 'Blau',
    green: 'Grün',
    pink: 'Pink',
    purple: 'Lila',
    yellow: 'Gelb',
    cyan: 'Cyan',
    red: 'Rot',
  },
  difficulties: {
    easy: {
      name: 'Leicht',
      description:
        'Reagiert langsam, boostet nie und greift nur mit großem Vorsprung an.',
    },
    normal: {
      name: 'Normal',
      description:
        'Frisst zuerst, greift an, wenn er stärker ist, und boostet, um durchzubrechen.',
    },
    hard: {
      name: 'Schwer',
      description:
        'Reagiert schnell, nimmt ausgeglichene Kämpfe an, stürmt auf deine nächsten Bakterien zu und boostet bei Kontakt.',
    },
  },
  series: {
    one: 'Einzelmatch',
    three: 'Best of 3',
    five: 'Best of 5',
  },
  players: {
    you: 'Du',
    computer: 'Computer',
    ghost: 'Geist',
    neutral: 'Neutral',
  },
  xp: {
    couch: 'Zwei Spieler',
    win: 'Sieg · {difficulty}',
    played: 'Gespielt · {difficulty}',
    medal: '{medal}medaille, neue Bestleistung',
    achievements: {
      one: 'Erfolg',
      other: '{count} Erfolge',
    },
  },
  unlocks: {
    earnAchievement: 'Hol dir „{achievement}“',
    reachRank: 'Erreiche den Rang {rank}',
    earnGold: 'Hol dir eine Goldmedaille',
    goldOn: 'Gold auf {title}',
    colonies: 'Kolonien in {color}',
    arena: 'Arena {title}',
  },
  continue: '{level} · {difficulty}',
};
