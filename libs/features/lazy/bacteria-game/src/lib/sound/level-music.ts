import {
  heatOf,
  lerp,
  parseGeneratedId,
  tuneSeed,
} from '../state/level-generator/generate-level';
import { keepRecent } from '../state/recent-cache';
import { Rng } from '../state/level-generator/rng';
import type { RecipeId } from '../state/level-generator/recipes';
import { seeded, streamSeed } from '../state/geometry';
import { HEART_PERIOD_SEC } from '../state/organic-maps';

/**
 * The background music of a level, composed from a handful of numbers.
 *
 * There are no recordings: a level names a key, a tempo, a chord
 * progression and a few instruments, and {@link composeLoop} writes a loop
 * of bass, pads, a melody and drums from them. The melody comes from a
 * seeded generator, so a level always plays the same tune - and since the
 * loop is plain data it can be tested without any audio.
 */

/** How the bass moves under the chords. */
export type BassStyle =
  /** One long note per bar. */
  | 'drone'
  /** The chord's root on every beat. */
  | 'root'
  /** Driving eighths. */
  | 'pulse'
  /** Root, fifth, octave and back - a walking line. */
  | 'walk';

/** The drum groove under a level. */
export type DrumStyle =
  /** None until the fighting starts - see {@link DRUM_LEVEL}. */
  | 'none'
  | 'soft'
  | 'drive'
  /** A double kick on every other beat - lub-dub. */
  | 'heart';

export interface LevelMusic {
  /** MIDI note of the key's root in the bass register - 45 is an A. */
  root: number;
  /** The scale as semitones above the root. */
  scale: readonly number[];
  bpm: number;
  /** One chord per bar, as the scale degree it is built on (0 = the root). */
  progression: readonly number[];
  /** The waveform of the melody. */
  lead: OscillatorType;
  /** How busy the melody is, from 0 (sparse) to 1 (a note on every eighth). */
  density: number;
  bass: BassStyle;
  drums: DrumStyle;
  /** Feedback of the echo, from 0 (dry) to about 0.5 (a cave). */
  echo: number;
  /** Seed of the melody - another seed is another tune. */
  seed: number;
}

/** Sixteenth notes per bar. */
export const STEPS_PER_BAR = 16;

export type MusicVoice = 'lead' | 'pad' | 'bass';
export type Drum = 'kick' | 'snare' | 'hat';

export interface MusicNote {
  voice: MusicVoice;
  /** The sixteenth of the loop it starts on. */
  step: number;
  /** How many sixteenths it lasts. */
  steps: number;
  midi: number;
  /** How hard it is played, from 0 to 1. */
  velocity: number;
}

export interface DrumHit {
  drum: Drum;
  step: number;
  velocity: number;
}

/** One pass of a level's music, repeated for as long as the match runs. */
export interface MusicLoop {
  /** Length in sixteenths. */
  steps: number;
  notes: MusicNote[];
  drums: DrumHit[];
}

/**
 * How loud the drums play before any fighting, from 0 to 1. Fights push them
 * up from there - a quiet level gets a groove once the colonies clash.
 */
export const DRUM_LEVEL: Record<DrumStyle, number> = {
  none: 0,
  soft: 0.5,
  drive: 0.9,
  heart: 0.8,
};

/** Seconds per sixteenth note at that tempo. */
export function stepSeconds(bpm: number): number {
  return 60 / bpm / 4;
}

/** The frequency of a MIDI note in Hz. */
export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * The MIDI note of a scale degree, any number of steps above or below the
 * root - degree 7 of a seven note scale is the root an octave up - and
 * `octaves` more octaves up from there.
 */
export function degreeToMidi(
  music: LevelMusic,
  degree: number,
  octaves = 0
): number {
  const length = music.scale.length;
  const octave = Math.floor(degree / length);
  const index = degree - octave * length;
  return music.root + 12 * (octave + octaves) + music.scale[index];
}

/**
 * Writes the loop of a level: the progression twice, the melody's motif
 * answered by a second one the second time round.
 */
export function composeLoop(music: LevelMusic): MusicLoop {
  const random = seeded(music.seed);
  const bars = music.progression.length * 2;
  const call = composeMotif(music, random);
  const answer = composeMotif(music, random);
  const notes: MusicNote[] = [];
  const drums: DrumHit[] = [];
  const octave = music.scale.length;

  for (let bar = 0; bar < bars; bar++) {
    const chord = music.progression[bar % music.progression.length];
    const start = bar * STEPS_PER_BAR;

    // The pad holds the chord - root, third and fifth - for the whole bar.
    for (const tone of [0, 2, 4]) {
      notes.push({
        voice: 'pad',
        step: start,
        steps: STEPS_PER_BAR,
        midi: degreeToMidi(music, octave + chord + tone),
        velocity: 1,
      });
    }

    notes.push(...bassLine(music, chord, start));

    // Every other bar of the second pass answers the call.
    const motif = bar >= bars / 2 && bar % 2 === 1 ? answer : call;
    for (const note of motif) {
      // Folded down an octave where the chord would carry it too high.
      let degree = chord + note.degree;
      if (degree > octave + 2) {
        degree -= octave;
      }
      notes.push({
        voice: 'lead',
        step: start + note.step,
        steps: note.steps,
        midi: degreeToMidi(music, 2 * octave + degree),
        velocity: note.step % 4 === 0 ? 1 : 0.75,
      });
    }

    drums.push(...drumBar(music.drums, start));
  }
  return { steps: bars * STEPS_PER_BAR, notes, drums };
}

interface MotifNote {
  step: number;
  steps: number;
  /** Scale degree above the chord's root. */
  degree: number;
}

/**
 * One bar of melody, relative to the chord under it: a rhythm on the eighths
 * that gets busier with the density, and a line that wanders by small steps
 * and lands on a chord tone on every beat.
 */
function composeMotif(music: LevelMusic, random: () => number): MotifNote[] {
  const onsets: number[] = [];
  for (let step = 0; step < STEPS_PER_BAR; step += 2) {
    const onBeat = step % 4 === 0;
    const chance = onBeat ? 0.35 + music.density * 0.6 : music.density * 0.7;
    if (step === 0 || random() < chance) {
      onsets.push(step);
    }
  }
  // Degrees count scale notes, so the octave is as far up as the scale is
  // long - seven for most scales, six for the whole tone scale.
  const octave = music.scale.length;
  const chordTones = [0, 2, 4, octave];
  let degree = Math.floor(random() * 3) * 2;
  return onsets.map((step, i) => {
    degree = Math.min(
      octave + 2,
      Math.max(-2, degree + Math.round((random() - 0.5) * 4))
    );
    if (step % 4 === 0) {
      // Land on the nearest of root, third, fifth and octave.
      degree = chordTones.reduce((best, tone) =>
        Math.abs(tone - degree) < Math.abs(best - degree) ? tone : best
      );
    }
    const next = onsets[i + 1] ?? STEPS_PER_BAR;
    return { step, steps: Math.min(4, next - step), degree };
  });
}

/** The bass of one bar, under the chord built on that degree. */
function bassLine(
  music: LevelMusic,
  chord: number,
  start: number
): MusicNote[] {
  const note = (step: number, steps: number, degree: number, velocity = 1) => ({
    voice: 'bass' as const,
    step: start + step,
    steps,
    midi: degreeToMidi(music, chord + degree),
    velocity,
  });
  const octave = music.scale.length;
  switch (music.bass) {
    case 'drone':
      return [note(0, STEPS_PER_BAR, 0)];
    case 'root':
      return [0, 4, 8, 12].map((step) =>
        note(step, 3, 0, step === 0 ? 1 : 0.8)
      );
    case 'pulse':
      return [0, 2, 4, 6, 8, 10, 12, 14].map((step) =>
        note(step, 1, step % 8 === 6 ? octave : 0, step % 4 === 0 ? 1 : 0.7)
      );
    case 'walk':
      return [0, 4, 8, 12].map((step, i) =>
        note(step, 4, [0, 4, octave, 4][i], i === 0 ? 1 : 0.8)
      );
  }
}

/** One bar of a groove. */
function drumBar(style: DrumStyle, start: number): DrumHit[] {
  const hit = (drum: Drum, step: number, velocity = 1) => ({
    drum,
    step: start + step,
    velocity,
  });
  switch (style) {
    case 'heart':
      return [
        hit('kick', 0),
        hit('kick', 2, 0.6),
        hit('kick', 8),
        hit('kick', 10, 0.6),
        hit('hat', 4, 0.4),
        hit('hat', 12, 0.4),
      ];
    case 'drive':
      return [
        ...[0, 4, 8, 12].map((step) => hit('kick', step)),
        hit('snare', 4),
        hit('snare', 12),
        ...[0, 2, 4, 6, 8, 10, 12, 14].map((step) =>
          hit('hat', step, step % 4 === 2 ? 0.8 : 0.5)
        ),
      ];
    // A quiet level still gets this groove once a fight heats up.
    case 'none':
    case 'soft':
      return [
        hit('kick', 0),
        hit('kick', 8, 0.8),
        hit('snare', 12, 0.5),
        ...[2, 6, 10, 14].map((step) => hit('hat', step, 0.6)),
      ];
  }
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11];
const MIXOLYDIAN = [0, 2, 4, 5, 7, 9, 10];
const HARMONIC_MINOR = [0, 2, 3, 5, 7, 8, 11];
/** Phrygian dominant - the sound of the desert. */
const PHRYGIAN_DOMINANT = [0, 1, 4, 5, 7, 8, 10];
const WHOLE_TONE = [0, 2, 4, 6, 8, 10];

/** The music of every level, by level id. */
export const LEVEL_MUSIC: Record<string, LevelMusic> = {
  // A warm, unhurried lullaby for the first steps.
  'petri-dish': {
    root: 45,
    scale: MAJOR,
    bpm: 84,
    progression: [0, 5, 3, 4],
    lead: 'triangle',
    density: 0.35,
    bass: 'root',
    drums: 'none',
    echo: 0.3,
    seed: 1,
  },
  // Cold lab techno.
  corridors: {
    root: 45,
    scale: MINOR,
    bpm: 112,
    progression: [0, 5, 2, 6],
    lead: 'square',
    density: 0.5,
    bass: 'pulse',
    drums: 'soft',
    echo: 0.25,
    seed: 2,
  },
  hourglass: {
    root: 43,
    scale: PHRYGIAN_DOMINANT,
    bpm: 96,
    progression: [0, 0, 1, 0],
    lead: 'sawtooth',
    density: 0.55,
    bass: 'drone',
    drums: 'soft',
    echo: 0.3,
    seed: 3,
  },
  // Under water: slow and echoing.
  'inner-ring': {
    root: 47,
    scale: DORIAN,
    bpm: 90,
    progression: [0, 3, 0, 4],
    lead: 'sine',
    density: 0.4,
    bass: 'walk',
    drums: 'none',
    echo: 0.45,
    seed: 4,
  },
  // A bright forest of pillars.
  'pillar-field': {
    root: 48,
    scale: LYDIAN,
    bpm: 100,
    progression: [0, 1, 0, 4],
    lead: 'triangle',
    density: 0.5,
    bass: 'root',
    drums: 'soft',
    echo: 0.3,
    seed: 5,
  },
  // Dreamy and unsettled - no key to rest in.
  'twin-chambers': {
    root: 44,
    scale: WHOLE_TONE,
    bpm: 80,
    progression: [0, 1, 0, 3],
    lead: 'sine',
    density: 0.35,
    bass: 'drone',
    drums: 'none',
    echo: 0.4,
    seed: 6,
  },
  // Fast and menacing.
  serpentine: {
    root: 45,
    scale: HARMONIC_MINOR,
    bpm: 132,
    progression: [0, 5, 3, 4],
    lead: 'sawtooth',
    density: 0.65,
    bass: 'pulse',
    drums: 'drive',
    echo: 0.2,
    seed: 7,
  },
  // A factory floor.
  pistons: {
    root: 40,
    scale: MINOR,
    bpm: 120,
    progression: [0, 0, 5, 4],
    lead: 'square',
    density: 0.55,
    bass: 'pulse',
    drums: 'drive',
    echo: 0.2,
    seed: 8,
  },
  // Breathing: slow, airy, open.
  alveoli: {
    root: 46,
    scale: MIXOLYDIAN,
    bpm: 76,
    progression: [0, 6, 3, 0],
    lead: 'sine',
    density: 0.4,
    bass: 'root',
    drums: 'soft',
    echo: 0.45,
    seed: 9,
  },
  // Something creeping in the dark.
  mycelium: {
    root: 42,
    scale: MINOR,
    bpm: 88,
    progression: [0, 2, 5, 4],
    lead: 'triangle',
    density: 0.45,
    bass: 'walk',
    drums: 'soft',
    echo: 0.4,
    seed: 10,
  },
  // In time with the heart of its map: a lub-dub on every other beat.
  heartbeat: {
    root: 45,
    scale: HARMONIC_MINOR,
    bpm: 120 / HEART_PERIOD_SEC,
    progression: [0, 5, 3, 4],
    lead: 'triangle',
    density: 0.5,
    bass: 'drone',
    drums: 'heart',
    echo: 0.35,
    seed: 11,
  },
  // Rolling waves, and the final battle.
  villi: {
    root: 43,
    scale: DORIAN,
    bpm: 104,
    progression: [0, 3, 6, 4],
    lead: 'sawtooth',
    density: 0.6,
    bass: 'walk',
    drums: 'drive',
    echo: 0.35,
    seed: 12,
  },
  // A ticking reactor: a pulsing bass under a cold, clipped lead.
  'half-life': {
    root: 42,
    scale: HARMONIC_MINOR,
    bpm: 118,
    progression: [0, 5, 3, 4],
    lead: 'square',
    density: 0.45,
    bass: 'pulse',
    drums: 'drive',
    echo: 0.3,
    seed: 13,
  },
  // Clean room hum: a slow drone under a bright, careful lead.
  containment: {
    root: 44,
    scale: LYDIAN,
    bpm: 100,
    progression: [0, 1, 4, 3],
    lead: 'triangle',
    density: 0.4,
    bass: 'drone',
    drums: 'soft',
    echo: 0.4,
    seed: 14,
  },
  // An alarm: a driving pulse under a tense, rising lead.
  'control-room': {
    root: 40,
    scale: PHRYGIAN_DOMINANT,
    bpm: 126,
    progression: [0, 1, 0, 6],
    lead: 'sawtooth',
    density: 0.5,
    bass: 'pulse',
    drums: 'drive',
    echo: 0.25,
    seed: 15,
  },
  // A boss fight: a heavy, fast pulse under a screaming lead.
  meltdown: {
    root: 41,
    scale: PHRYGIAN_DOMINANT,
    bpm: 138,
    progression: [0, 1, 4, 1],
    lead: 'sawtooth',
    density: 0.6,
    bass: 'pulse',
    drums: 'drive',
    echo: 0.2,
    seed: 16,
  },
  // Waiting behind glass: sparse, tense and patient.
  quarantine: {
    root: 43,
    scale: HARMONIC_MINOR,
    bpm: 104,
    progression: [0, 3, 0, 4],
    lead: 'triangle',
    density: 0.4,
    bass: 'pulse',
    drums: 'heart',
    echo: 0.4,
    seed: 18,
  },
  // A feast: bouncy, quick and greedy.
  'feeding-ground': {
    root: 45,
    scale: MAJOR,
    bpm: 132,
    progression: [0, 3, 4, 3],
    lead: 'square',
    density: 0.6,
    bass: 'pulse',
    drums: 'drive',
    echo: 0.2,
    seed: 19,
  },
  // Wide open: slow, airy and far-reaching.
  expanse: {
    root: 40,
    scale: LYDIAN,
    bpm: 92,
    progression: [0, 4, 1, 4],
    lead: 'sine',
    density: 0.35,
    bass: 'drone',
    drums: 'heart',
    echo: 0.5,
    seed: 20,
  },
  // Where it began: slow, cold dread that builds.
  'patient-zero': {
    root: 41,
    scale: HARMONIC_MINOR,
    bpm: 96,
    progression: [0, 6, 5, 4],
    lead: 'square',
    density: 0.45,
    bass: 'drone',
    drums: 'heart',
    echo: 0.45,
    seed: 17,
  },
};

/**
 * The music of the level with that id, falling back to the first level's. A
 * generated level gets a tune of its own - see {@link generatedMusic}.
 */
export function levelMusic(levelId: string): LevelMusic {
  return (
    LEVEL_MUSIC[levelId] ?? generatedMusic(levelId) ?? LEVEL_MUSIC['petri-dish']
  );
}

/**
 * The tunes of the generated levels asked for lately, by id: the player
 * restarts a tune it is handed anew, so one id keeps one tune. Built from
 * the id alone - a tune needs no layout.
 */
const generatedTunes = new Map<string, LevelMusic>();
const KEPT_TUNES = 32;

/**
 * How each style of the generator sounds: the mood of its key, its groove
 * and its instruments - the seed then picks the chords, the key's pitch and
 * the melody, the difficulty the tempo.
 */
const STYLE_SOUNDS: Record<
  RecipeId,
  Pick<LevelMusic, 'root' | 'scale' | 'lead' | 'bass' | 'drums' | 'echo'>
> = {
  // Open ground: bright and calm.
  field: {
    root: 45,
    scale: MAJOR,
    lead: 'triangle',
    bass: 'root',
    drums: 'soft',
    echo: 0.3,
  },
  // Walls and gates: driving, mechanical.
  corridor: {
    root: 45,
    scale: MINOR,
    lead: 'square',
    bass: 'pulse',
    drums: 'drive',
    echo: 0.35,
  },
  // Keeps to hold: a marching walk.
  fortress: {
    root: 43,
    scale: DORIAN,
    lead: 'sawtooth',
    bass: 'walk',
    drums: 'drive',
    echo: 0.25,
  },
  // Living tissue: dark, wet, a pulse.
  cave: {
    root: 41,
    scale: HARMONIC_MINOR,
    lead: 'sine',
    bass: 'drone',
    drums: 'heart',
    echo: 0.45,
  },
};

/** The chord progressions a generated tune picks from - a few of the hand-made tunes'. */
const PROGRESSIONS: readonly (readonly number[])[] = [
  [0, 5, 3, 4],
  [0, 3, 6, 4],
  [0, 5, 2, 6],
  [0, 2, 5, 4],
  [0, 1, 0, 4],
  [0, 6, 3, 0],
];

/** The tune of a generated level: its style's sound, its seed's chords. */
function generatedMusic(levelId: string): LevelMusic | undefined {
  const kept = generatedTunes.get(levelId);
  if (kept !== undefined) {
    return kept;
  }
  const made = parseGeneratedId(levelId);
  if (made === null) {
    return undefined;
  }
  const seed = tuneSeed(made);
  // Another stream than the melody's, so the two do not go hand in hand.
  const rng = new Rng(streamSeed(seed, 1));
  const sound = STYLE_SOUNDS[made.recipe];
  const tune: LevelMusic = {
    ...sound,
    // A step or two up or down: another key, the same mood.
    root: sound.root + rng.int(-2, 2),
    progression: rng.pick(PROGRESSIONS),
    density: rng.range(0.3, 0.6),
    // A hotter level, a faster beat.
    bpm: Math.round(lerp(84, 134, heatOf(made))),
    seed,
  };
  return keepRecent(generatedTunes, levelId, tune, KEPT_TUNES);
}
