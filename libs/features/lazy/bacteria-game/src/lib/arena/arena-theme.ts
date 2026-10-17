/** A colour as red, green and blue from 0 to 255. */
export type Rgb = readonly [number, number, number];

/** The texture laid over the floor of an arena. */
export type ArenaPattern =
  | 'agar'
  | 'grid'
  | 'dunes'
  | 'rings'
  | 'hex'
  | 'cells'
  | 'veins'
  | 'circuit';

/**
 * How a level looks and sounds: the floor the colonies fight on, its walls,
 * the frame around it and the hum underneath.
 *
 * Every floor stays dark, so the orange and blue colonies always stand out
 * against it - the texture is there to give a level its own place, not to
 * compete with the fight.
 */
export interface ArenaTheme {
  /** Floor colour in the middle of the arena. */
  floor: Rgb;
  /** Floor colour towards the rim - the vignette that frames the arena. */
  rim: Rgb;
  pattern: ArenaPattern;
  /** Colour the pattern is drawn in, over the floor. */
  patternColor: Rgb;
  /** How strongly the pattern shows, from 0 to 1. */
  patternStrength: number;
  wall: Rgb;
  /** The lit edge of a wall. */
  wallEdge: Rgb;
  /** The bright frame around the arena, and the hazard colour of moving walls. */
  border: Rgb;
  /** Specks drifting over the floor. */
  motes: Rgb;
  moteCount: number;
  /** Which way and how fast the specks drift, in arena pixels per second. */
  current: { x: number; y: number };
  /** Base pitch of the level's ambient hum in Hz. */
  droneHz: number;
}

const THEMES: Record<string, ArenaTheme> = {
  'petri-dish': {
    floor: [30, 25, 14],
    rim: [8, 6, 3],
    pattern: 'agar',
    patternColor: [88, 72, 34],
    patternStrength: 0.45,
    wall: [190, 170, 130],
    wallEdge: [245, 230, 190],
    border: [235, 195, 110],
    motes: [250, 230, 170],
    moteCount: 26,
    current: { x: 1.5, y: -0.8 },
    droneHz: 55,
  },
  corridors: {
    floor: [10, 20, 34],
    rim: [2, 5, 12],
    pattern: 'grid',
    patternColor: [44, 92, 150],
    patternStrength: 0.55,
    wall: [120, 150, 190],
    wallEdge: [200, 225, 255],
    border: [90, 170, 255],
    motes: [150, 200, 255],
    moteCount: 20,
    current: { x: 0, y: 2 },
    droneHz: 49,
  },
  hourglass: {
    floor: [34, 22, 10],
    rim: [10, 5, 2],
    pattern: 'dunes',
    patternColor: [96, 62, 26],
    patternStrength: 0.5,
    wall: [200, 150, 90],
    wallEdge: [255, 210, 150],
    border: [255, 165, 70],
    motes: [255, 210, 140],
    moteCount: 34,
    current: { x: 4, y: 0.5 },
    droneHz: 46,
  },
  'inner-ring': {
    floor: [6, 26, 26],
    rim: [1, 7, 8],
    pattern: 'rings',
    patternColor: [26, 110, 102],
    patternStrength: 0.5,
    wall: [110, 190, 180],
    wallEdge: [190, 255, 245],
    border: [80, 240, 210],
    motes: [150, 255, 235],
    moteCount: 24,
    current: { x: -1.2, y: 1.2 },
    droneHz: 52,
  },
  'pillar-field': {
    floor: [10, 24, 10],
    rim: [2, 7, 3],
    pattern: 'hex',
    patternColor: [36, 100, 44],
    patternStrength: 0.55,
    wall: [130, 180, 120],
    wallEdge: [200, 255, 190],
    border: [140, 255, 120],
    motes: [190, 255, 170],
    moteCount: 22,
    current: { x: 1, y: 1.5 },
    droneHz: 58,
  },
  'twin-chambers': {
    floor: [22, 10, 30],
    rim: [6, 2, 10],
    pattern: 'cells',
    patternColor: [86, 44, 118],
    patternStrength: 0.55,
    wall: [170, 130, 200],
    wallEdge: [230, 200, 255],
    border: [200, 130, 255],
    motes: [225, 190, 255],
    moteCount: 22,
    current: { x: -1.5, y: -1 },
    droneHz: 44,
  },
  serpentine: {
    floor: [30, 6, 9],
    rim: [9, 1, 2],
    pattern: 'veins',
    patternColor: [120, 22, 34],
    patternStrength: 0.6,
    wall: [190, 110, 110],
    wallEdge: [255, 180, 175],
    border: [255, 90, 100],
    motes: [255, 160, 160],
    moteCount: 30,
    current: { x: 2.5, y: 2.5 },
    droneHz: 41,
  },
  pistons: {
    floor: [17, 17, 20],
    rim: [4, 4, 5],
    pattern: 'circuit',
    patternColor: [64, 66, 78],
    patternStrength: 0.6,
    wall: [150, 150, 160],
    wallEdge: [215, 215, 225],
    border: [255, 205, 60],
    motes: [255, 225, 140],
    moteCount: 18,
    current: { x: 0, y: -1.5 },
    droneHz: 37,
  },
};

/** The look of the level with that id, falling back to the petri dish. */
export function arenaTheme(levelId: string): ArenaTheme {
  return THEMES[levelId] ?? THEMES['petri-dish'];
}

/** The colour as the space separated triple CSS `rgb()` takes. */
export function cssTriple([r, g, b]: Rgb): string {
  return `${r} ${g} ${b}`;
}
