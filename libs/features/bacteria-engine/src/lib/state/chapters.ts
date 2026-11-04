import type { levels as levelTexts } from '../i18n/en/levels';

/** The id of a chapter, as the dictionaries list it. */
export type ChapterId = keyof typeof levelTexts.chapters;

/** A stretch of the ladder with a story of its own - see the design notes. */
export interface Chapter {
  id: ChapterId;
  name: string;
  /** What the chapter brings, in a line. */
  blurb: string;
  /** Its levels, in the order of the ladder. */
  levelIds: readonly string[];
}

/** The ladder in chapters: every level of it in exactly one, in order. */
export const CHAPTERS: readonly Chapter[] = [
  {
    id: 'petri',
    name: 'Petri',
    blurb: 'Steering, the boost, the food - and a first gate.',
    levelIds: ['petri-dish', 'corridors', 'hourglass'],
  },
  {
    id: 'laboratory',
    name: 'Laboratory',
    blurb: 'Cover, chambers and walls that move.',
    levelIds: [
      'inner-ring',
      'pillar-field',
      'twin-chambers',
      'serpentine',
      'pistons',
    ],
  },
  {
    id: 'body',
    name: 'Body',
    blurb: 'Living walls that grow, beat and sway.',
    levelIds: ['alveoli', 'mycelium', 'heartbeat', 'villi'],
  },
  {
    id: 'reactor',
    name: 'Reactor',
    blurb: 'A clock, ground that fights back, a zone to hold - and a boss.',
    levelIds: ['half-life', 'containment', 'control-room', 'meltdown'],
  },
  {
    id: 'outbreak',
    name: 'Outbreak',
    blurb:
      'Bosses bigger than you, grey colonies nobody steers, a race to eat.',
    levelIds: ['patient-zero', 'quarantine', 'feeding-ground'],
  },
  {
    id: 'expanse',
    name: 'Expanse',
    blurb:
      'Maps bigger than the screen - the camera follows you over islands, vessels and caves to the leviathan.',
    levelIds: [
      'expanse',
      'archipelago',
      'bloodstream',
      'root-network',
      'leviathan',
    ],
  },
];
