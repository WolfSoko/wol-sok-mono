import type { achievements as en } from '../en/achievements';
import type { Translation } from '../translation';

export const achievements: Translation<typeof en> = {
  'first-blood': {
    name: 'Erstes Blut',
    condition: 'Gewinne ein Match gegen den Computer',
  },
  pacifist: {
    name: 'Pazifist',
    condition: 'Gewinne, ohne einen Boost zu zünden',
  },
  blitz: {
    name: 'Blitz',
    condition: 'Gewinne in unter {seconds} Sekunden',
  },
  comeback: {
    name: 'Comeback',
    condition:
      'Gewinne, nachdem du unter ein Viertel der Größe des Gegners gefallen bist',
  },
  siege: {
    name: 'Belagerung',
    condition: 'Gewinne ein Match von {minutes} Minuten oder länger',
  },
  'clean-sweep': {
    name: 'Weiße Weste',
    condition:
      'Gewinne und verliere dabei unter {percent} % deiner Kolonie auf ihrem Höchststand',
  },
  'full-dish': {
    name: 'Volle Schale',
    condition: 'Lass deine Kolonie so groß wachsen, wie die Schale es zulässt',
  },
  gatekeeper: {
    name: 'Torwächter',
    condition: 'Lass Wände {count} gegnerische Bakterien zerquetschen',
  },
  converter: {
    name: 'Bekehrer',
    condition: 'Übernimm {count} gegnerische Bakterien',
  },
  glutton: {
    name: 'Vielfraß',
    condition: 'Friss {count} Pellets gegen den Computer',
  },
  flawless: {
    name: 'Makellos',
    condition: 'Hol dir eine Platinmedaille',
  },
  'petri-scholar': {
    name: 'Petri-Gelehrter',
    condition: 'Gold in jedem Level des Kapitels {chapter}',
  },
  'hard-boiled': {
    name: 'Hartgesotten',
    condition: 'Gewinne jedes Level auf Schwer',
  },
  'couch-war': {
    name: 'Sofakrieg',
    condition: 'Spiele {count} Matches zu zweit',
  },
};
