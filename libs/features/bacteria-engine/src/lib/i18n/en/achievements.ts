/**
 * The achievements by id: a short name and the one-line condition, its
 * numbers as placeholders. `state/achievements.ts` takes its English texts
 * from here.
 */
export const achievements = {
  'first-blood': {
    name: 'First Blood',
    condition: 'Win a match against the computer',
  },
  pacifist: {
    name: 'Pacifist',
    condition: 'Win without firing a boost',
  },
  blitz: {
    name: 'Blitz',
    condition: 'Win in under {seconds} seconds',
  },
  comeback: {
    name: 'Comeback',
    condition: 'Win after falling below a quarter of the enemy’s size',
  },
  siege: {
    name: 'Siege',
    condition: 'Win a match of {minutes} minutes or more',
  },
  'clean-sweep': {
    name: 'Clean Sweep',
    condition: 'Win losing under {percent} % of your colony at its peak',
  },
  'full-dish': {
    name: 'Full Dish',
    condition: 'Grow your colony as big as the dish lets it',
  },
  gatekeeper: {
    name: 'Gatekeeper',
    condition: 'Let walls crush {count} enemy bacteria',
  },
  converter: {
    name: 'Converter',
    condition: 'Capture {count} enemy bacteria',
  },
  glutton: {
    name: 'Glutton',
    condition: 'Eat up {count} pellets against the computer',
  },
  flawless: {
    name: 'Flawless',
    condition: 'Earn a platinum medallion',
  },
  'petri-scholar': {
    name: 'Petri Scholar',
    condition: 'Gold on every level of the {chapter} chapter',
  },
  'hard-boiled': {
    name: 'Hard Boiled',
    condition: 'Win every level on Hard',
  },
  'couch-war': {
    name: 'Couch War',
    condition: 'Play {count} matches between two players',
  },
};
