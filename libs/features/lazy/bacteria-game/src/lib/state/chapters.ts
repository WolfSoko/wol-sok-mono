/** A stretch of the ladder with a story of its own - see the design notes. */
export interface Chapter {
  name: string;
  /** What the chapter brings, in a line. */
  blurb: string;
  /** Its levels, in the order of the ladder. */
  levelIds: readonly string[];
}

/** The ladder in chapters: every level of it in exactly one, in order. */
export const CHAPTERS: readonly Chapter[] = [
  {
    name: 'Petri',
    blurb: 'Steering, the boost, the food - and a first gate.',
    levelIds: ['petri-dish', 'corridors', 'hourglass'],
  },
  {
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
    name: 'Body',
    blurb: 'Living walls that grow, beat and sway.',
    levelIds: ['alveoli', 'mycelium', 'heartbeat', 'villi'],
  },
  {
    name: 'Reactor',
    blurb: 'A clock, ground that fights back, a zone to hold - and a boss.',
    levelIds: ['half-life', 'containment', 'control-room', 'meltdown'],
  },
  {
    name: 'Outbreak',
    blurb:
      'Grey colonies nobody steers, and bosses bigger and hungrier than you.',
    levelIds: ['quarantine', 'patient-zero'],
  },
];
