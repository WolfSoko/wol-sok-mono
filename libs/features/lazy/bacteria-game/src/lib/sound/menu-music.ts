import { clamp, seeded } from '../state/geometry';
import { STEPS_PER_BAR, stepSeconds } from './level-music';

/**
 * The music of the menu: a slow, warm ambient piece to rest in between
 * matches - and to want to stay in for a while.
 *
 * Like the level music it is composed, not recorded: eight lush chords in
 * C, two bars each, held by a pad over a sub bass, with bells arpeggiating
 * the chord tones on top and a breath of filtered noise swelling under every
 * chord like a distant tide. {@link composeMenuMusic} writes one pass of it
 * from a seed; the player asks for another seed on every pass, so the bells
 * never quite repeat themselves while the chords stay the same.
 */

export const MENU_BPM = 66;
/** MIDI note of C3 - the chords are built from here. */
export const MENU_ROOT = 48;
/** Every chord holds for two bars. */
export const STEPS_PER_CHORD = 2 * STEPS_PER_BAR;

/**
 * The chords, as semitones above the root, low to high - ninths and sixths
 * throughout, so nothing ever quite resolves: Cmaj9, Am9, Fmaj9, Gsus4 add9,
 * Em9, Dm9, Fmaj9 and G6/9.
 */
export const MENU_CHORDS: readonly (readonly number[])[] = [
  [0, 4, 7, 11, 14],
  [-3, 0, 4, 7, 11],
  [5, 9, 12, 16, 19],
  [7, 12, 14, 19, 21],
  [4, 7, 11, 14, 18],
  [2, 5, 9, 12, 16],
  [5, 9, 12, 16, 19],
  [7, 11, 14, 16, 21],
];

export type MenuVoice = 'pad' | 'bass' | 'bell' | 'breath';

export interface MenuNote {
  voice: MenuVoice;
  /** The sixteenth of the pass it starts on. */
  step: number;
  /** How many sixteenths it lasts - for a bell, how long it rings. */
  steps: number;
  /** The pitch - for a breath, the centre of its filter. */
  midi: number;
  /** How hard it is played, from 0 to 1. */
  velocity: number;
  /** Where it sits in the stereo field, from -1 (left) to 1 (right). */
  pan: number;
}

/** One pass of the menu music, all the chords once. */
export interface MenuScore {
  /** Length in sixteenths. */
  steps: number;
  notes: MenuNote[];
}

/** Seconds per sixteenth of the menu music. */
export const MENU_STEP_SEC = stepSeconds(MENU_BPM);

/**
 * Writes one pass of the menu music. The pads, the bass and the breaths
 * are the same every pass; the bells come from the seed.
 */
export function composeMenuMusic(seed: number): MenuScore {
  const random = seeded(seed);
  const notes: MenuNote[] = [];
  // Which of the chord's tones the last bell rang - the next one steps from it.
  let bellIndex = Math.floor(random() * 3);

  MENU_CHORDS.forEach((chord, index) => {
    const start = index * STEPS_PER_CHORD;

    // The pad holds the whole chord an octave up, where it sings.
    for (const tone of chord) {
      notes.push({
        voice: 'pad',
        step: start,
        steps: STEPS_PER_CHORD,
        midi: MENU_ROOT + 12 + tone,
        velocity: 1,
        pan: 0,
      });
    }

    // The bass: the root under the chord, and its fifth, softer, in the
    // second bar - to give the chord a second breath.
    const root = chord[0];
    notes.push(
      {
        voice: 'bass',
        step: start,
        steps: STEPS_PER_BAR,
        midi: MENU_ROOT - 12 + root,
        velocity: 1,
        pan: 0,
      },
      {
        voice: 'bass',
        step: start + STEPS_PER_BAR,
        steps: STEPS_PER_BAR,
        midi: MENU_ROOT - 12 + root + 7,
        velocity: 0.6,
        pan: 0,
      }
    );

    // A breath of noise somewhere in the first bar, swelling into the second.
    notes.push({
      voice: 'breath',
      step: start + Math.floor(random() * 8),
      steps: STEPS_PER_BAR + 8,
      midi: 72 + Math.floor(random() * 10),
      velocity: 0.6 + random() * 0.4,
      pan: random() * 1.2 - 0.6,
    });

    // Bells wander over the chord tones two octaves up, mostly on the
    // eighths, now and then on a sixteenth in between - sparse enough to
    // leave room for the echo to answer.
    for (let step = 0; step < STEPS_PER_CHORD; step++) {
      const onEighth = step % 2 === 0;
      const chance = step === 0 ? 1 : onEighth ? 0.42 : 0.08;
      if (random() >= chance) {
        continue;
      }
      bellIndex = clamp(
        bellIndex + Math.round((random() - 0.5) * 3),
        0,
        chord.length - 1
      );
      notes.push({
        voice: 'bell',
        step: start + step,
        steps: 6,
        midi: MENU_ROOT + 24 + chord[bellIndex],
        velocity: (onEighth ? 0.6 : 0.4) + random() * 0.4,
        pan: random() * 1.4 - 0.7,
      });
    }
  });

  return { steps: MENU_CHORDS.length * STEPS_PER_CHORD, notes };
}
