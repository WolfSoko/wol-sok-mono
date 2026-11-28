/**
 * The gate boost's sound: a rumble of cells pressing against the shut gate,
 * the leaves whirring apart, a clunk and the lamps' chime, the boost, and
 * from the bar the jet reaches orange on, the full groove while blue turns
 * it.
 */
import { kick } from '../../../promo-video/short/short-audio';
import { hz, seededRandom } from '../../../promo-video/synth';
import { boost, hit, noiseFrom, scatter, turns } from '../effects';
import {
  bassline,
  blips,
  BOTH_BARS,
  Chord,
  claps,
  FIRST_BAR,
  hats,
  kicks,
  pad,
  SECOND_BAR,
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
  sizzle,
  slide,
  swell,
  warm,
} from '../voices';

const SEED = 32;

/* The frames of blender/scenes/gate_boost.py. */
/** `GATE_OPENS, GATE_OPEN = 26, 34`: the leaves slide apart between them. */
const GATE_OPENS = 26;
const GATE_OPEN = 34;
/** `BOOST = (32, 96)`. */
const BOOST = { from: 32, to: 96 };
/** Timeline, 56 (the poster): the jet reaches orange. */
const JET_REACHES_ORANGE = 56;
/** Timeline, 60-110: blue closes round orange and turns it. */
const ORANGE_TURNS = { from: 60, to: 110 };

/** Frames between two orange cells turning blue, on average. */
const TURN_EVERY = 2.5;
/** The pitch of the gate's motor as the leaves start and stop (Hz). */
const MOTOR = { from: 160, to: 480 };

export const gateBoost: ShotScore = (take, chord) => {
  const rnd = seededRandom(SEED);
  const noise = noiseFrom(rnd);

  pad(take, chord, 0, take.seconds);
  bassline(take, chord, BOTH_BARS);
  hats(take, noise, BOTH_BARS);
  kicks(take, SECOND_BAR);
  claps(take, noise, SECOND_BAR);
  blips(take, chord, rnd, FIRST_BAR, 0.2);
  blips(take, chord, rnd, SECOND_BAR, 0.5);

  pressure(take, noise);
  gate(take, chord, noise);
  boost(
    take,
    frameSeconds(BOOST.from),
    frameSeconds(BOOST.to) - frameSeconds(BOOST.from),
    noise,
    hz(chord[0] + 12)
  );
  hit(take, frameSeconds(JET_REACHES_ORANGE), noise, 0.5);
  turns(
    take,
    scatter(ORANGE_TURNS.from, ORANGE_TURNS.to, TURN_EVERY, rnd),
    chord,
    'blue',
    rnd
  );
};

/** The colony masses against the shut gate: a rumble that swells until it opens. */
function pressure(take: Take, noise: () => number): void {
  const seconds = frameSeconds(GATE_OPENS);
  const release = 0.3;
  take.add(
    0,
    seconds + release,
    shaped(
      hiss(noise, () => 0.03),
      swell(seconds, seconds + release, release)
    ),
    0,
    0.9
  );
}

/** The leaves whir apart, stop with a clunk, and the lamps chime green. */
function gate(take: Take, chord: Chord, noise: () => number): void {
  const opens = frameSeconds(GATE_OPENS);
  const open = frameSeconds(GATE_OPEN);
  const sliding = open - opens;
  const motorHum = (t: number) => 0.7 + 0.3 * Math.sin(2 * Math.PI * 40 * t);
  take.add(
    opens,
    sliding,
    shaped(
      oscillator(slide(MOTOR.from, MOTOR.to, sliding), warm),
      motorHum,
      swell(0.03, sliding, 0.05)
    ),
    0,
    0.09
  );
  take.add(
    opens,
    sliding,
    shaped(sizzle(noise, 0.2), swell(0.03, sliding, 0.05)),
    0,
    0.03
  );
  take.add(open, 0.15, kick(180, 70, 30), 0, 0.35);
  for (const [k, note] of [chord[2] + 24, chord[0] + 36].entries()) {
    take.add(
      open + k * 0.07,
      0.5,
      shaped(oscillator(pitch(note), glassy), decay(9)),
      0.3,
      0.07
    );
  }
}
