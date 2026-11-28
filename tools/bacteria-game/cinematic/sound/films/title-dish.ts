/**
 * The title dish's sound, the end card: the home chord under cells that
 * jostle, notes that climb it as the camera rises, and where the camera
 * stops above the dish the chord struck as bells, ringing out.
 */
import { seededRandom } from '../../../promo-video/synth';
import { noiseFrom, thump } from '../effects';
import {
  BEAT,
  blips,
  Chord,
  downbeat,
  FIRST_BAR,
  pad,
  ShotScore,
} from '../score';
import { frameSeconds, Take } from '../take';
import {
  decay,
  glassy,
  hiss,
  oscillator,
  pitch,
  shaped,
  warm,
} from '../voices';

const SEED = 97;

/* The frames of blender/scenes/title_dish.py. */
/** `RISE_START = 28`: the camera rises from the frame after it. */
const RISE_STARTS = 29;
/** `HOLD_START = 96`: the camera stands still from the frame after it. */
const HOLD_STARTS = 97;

const EIGHTH = BEAT / 2;
/** The pad carries this shot alone: its loudness at the opening and at the hold. */
const PAD_AT_OPENING = 1.2;
const PAD_AT_HOLD = 1.8;
/** The bells of the last chord: the chord an octave up, and its root above that. */
const BELL_OCTAVE = 12;

export const titleDish: ShotScore = (take, chord) => {
  const rnd = seededRandom(SEED);
  const hold = frameSeconds(HOLD_STARTS);

  pad(
    take,
    chord,
    0,
    take.seconds,
    (t) =>
      PAD_AT_OPENING + (PAD_AT_HOLD - PAD_AT_OPENING) * Math.min(1, t / hold)
  );
  downbeat(take, 0, chord);
  blips(take, chord, rnd, FIRST_BAR, 0.5);
  climb(take, chord);
  lift(take, noiseFrom(rnd));
  lastChord(take, chord);
};

/** The camera rises: up the chord, a note per eighth, each a little louder. */
function climb(take: Take, chord: Chord): void {
  const first = Math.ceil(frameSeconds(RISE_STARTS) / EIGHTH);
  const last = Math.floor(frameSeconds(HOLD_STARTS) / EIGHTH);
  const steps = last - first;
  for (let step = 0; step < steps; step++) {
    const octaves = Math.floor(step / chord.length);
    const note = chord[step % chord.length] + 12 * octaves;
    take.add(
      (first + step) * EIGHTH,
      0.6,
      shaped(oscillator(pitch(note), warm), decay(5)),
      step % 2 ? 0.4 : -0.4,
      0.09 + (0.07 * step) / steps
    );
  }
}

/** Air under the rise: a hiss that opens until the camera stops. */
function lift(take: Take, noise: () => number): void {
  const from = frameSeconds(RISE_STARTS);
  const seconds = frameSeconds(HOLD_STARTS) - from;
  take.add(
    from,
    seconds,
    shaped(
      hiss(noise, (t) => 0.01 + 0.2 * (t / seconds) ** 2),
      (t) => (t / seconds) ** 2
    ),
    0,
    0.14
  );
}

/** The hold: the chord as bells over a low blow, ringing to the film's end. */
function lastChord(take: Take, chord: Chord): void {
  const at = frameSeconds(HOLD_STARTS);
  const ringing = take.seconds - at;
  thump(take, at, 0.55);
  const bells = [...chord, chord[0] + 12].map((note) => note + BELL_OCTAVE);
  for (const [k, note] of bells.entries()) {
    take.add(
      at,
      ringing,
      shaped(oscillator(pitch(note), glassy), decay(1.2)),
      (k - 1.5) * 0.4,
      0.09
    );
  }
}
