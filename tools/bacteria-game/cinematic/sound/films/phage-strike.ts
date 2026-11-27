/**
 * The phage strike's sound: the crosshair locks on, the first phage whistles
 * down and lands, the squadron patters down behind it while the charge
 * hums up, the strike zaps and the cells pop from the middle outwards. The
 * groove starts on the bar after the strike; orange's boost falls on a beat
 * of it.
 */
import { kick } from '../../../promo-video/short/short-audio';
import { hz, seededRandom } from '../../../promo-video/synth';
import { boost, hit, noiseFrom, scatter } from '../effects';
import {
  bassline,
  blips,
  Chord,
  claps,
  downbeat,
  hats,
  kicks,
  pad,
  SECOND_BAR,
  ShotScore,
} from '../score';
import { FPS, frameSeconds, Take } from '../take';
import {
  decay,
  glassy,
  oscillator,
  pitch,
  shaped,
  sizzle,
  slide,
  swell,
  warm,
} from '../voices';

const SEED = 20;

/* The frames and sizes of blender/scenes/phage_strike.py. */
/** `AIMED = 14`: the crosshair is on its target. */
const AIMED = 14;
/** `HERO_TOUCH = 20`: the phage the camera watches lands. */
const HERO_TOUCH = 20;
/** Timeline, 32-38: the squadron comes down behind it. `PHAGES = 10` with the first. */
const SQUADRON_LANDS = { from: 32, to: 38 };
const SQUADRON = 9;
/** Timeline, 25-43: the first phage stands charging. */
const CHARGING = { from: 25, to: 43 };
/** `STRIKE_FRAME = 44`: the cells under the crosshair light up. */
const STRIKE_FRAME = 44;
/** `WAVE = 6.0` frames per scene unit outwards, over `STRIKE_RADIUS = 2.4` units. */
const WAVE = 6;
const STRIKE_RADIUS = 2.4;
/** Timeline, 50-57: the first phage's tail contracts, light runs into the cell. */
const HERO_FIRES = { from: 50, to: 57 };
/** `RISE = (58, 86)`: sparks fly, the phages wither. */
const SPARKS = { from: 58, to: 86 };
/** `BOOST = (82, END)`: orange boosts into the gap. */
const BOOST = { from: 82, to: 120 };

/** Cells heard bursting: a share of the hundreds that do. */
const BURSTS = 22;
/** Frames between two sparks, on average. */
const SPARK_EVERY = 2.2;

export const phageStrike: ShotScore = (take, chord) => {
  const rnd = seededRandom(SEED);
  const noise = noiseFrom(rnd);

  pad(take, chord, 0, take.seconds);
  downbeat(take, 0, chord);
  kicks(take, SECOND_BAR);
  claps(take, noise, SECOND_BAR);
  bassline(take, chord, SECOND_BAR);
  hats(take, noise, SECOND_BAR);
  blips(take, chord, rnd, SECOND_BAR, 0.4);

  lockOn(take, chord);
  fall(take);
  landing(take, frameSeconds(HERO_TOUCH), chord[0] + 24, 0, 1, noise);
  squadron(take, chord, rnd);
  charge(take, chord);
  strike(take, noise);
  bursts(take, rnd);
  injection(take);
  sparks(take, rnd);
  boost(
    take,
    frameSeconds(BOOST.from),
    frameSeconds(BOOST.to) - frameSeconds(BOOST.from),
    noise,
    hz(chord[0])
  );
};

/** The crosshair is on its target: two short beeps. */
function lockOn(take: Take, chord: Chord): void {
  const f = hz(chord[0] + 36);
  for (const offset of [0, 0.09]) {
    take.add(
      frameSeconds(AIMED) + offset,
      0.05,
      shaped(
        oscillator(() => f),
        swell(0.004, 0.05, 0.02)
      ),
      0,
      0.06
    );
  }
}

/** The first phage comes down: a whistle that falls until it touches. */
function fall(take: Take): void {
  const seconds = frameSeconds(HERO_TOUCH);
  take.add(
    0,
    seconds,
    shaped(
      oscillator(slide(2400, 700, seconds)),
      swell(seconds * 0.7, seconds, 0.04)
    ),
    -0.2,
    0.035
  );
}

/** A phage lands on its fibres: a tick, a small thud and a glassy ring. */
function landing(
  take: Take,
  at: number,
  note: number,
  pan: number,
  gain: number,
  noise: () => number
): void {
  take.add(at, 0.02, shaped(sizzle(noise, 0.3), decay(200)), pan, 0.15 * gain);
  take.add(at, 0.2, kick(160, 70, 22), pan, 0.3 * gain);
  take.add(
    at,
    0.3,
    shaped(oscillator(pitch(note), glassy), decay(18)),
    pan,
    0.07 * gain
  );
}

/** The rest of the squadron lands within a few frames, all over the colony. */
function squadron(take: Take, chord: Chord, rnd: () => number): void {
  const noise = noiseFrom(rnd);
  const frames = SQUADRON_LANDS.to - SQUADRON_LANDS.from;
  for (let phage = 0; phage < SQUADRON; phage++) {
    landing(
      take,
      frameSeconds(SQUADRON_LANDS.from + rnd() * frames),
      chord[phage % chord.length] + 36,
      rnd() * 1.6 - 0.8,
      0.5,
      noise
    );
  }
}

/** The landed phage charges: a hum that climbs an octave and grows. */
function charge(take: Take, chord: Chord): void {
  const from = frameSeconds(CHARGING.from);
  const seconds = frameSeconds(STRIKE_FRAME) - from;
  const low = hz(chord[0] - 12);
  const flutter = (t: number) =>
    0.7 + 0.3 * Math.sin(2 * Math.PI * (8 + 20 * (t / seconds)) * t);
  take.add(
    from,
    seconds,
    shaped(
      oscillator(slide(low, low * 2, seconds), warm),
      flutter,
      (t) => (t / seconds) ** 2
    ),
    0,
    0.14
  );
}

/** The strike: a zap that tears down through the pitches, and a hard hit. */
function strike(take: Take, noise: () => number): void {
  const at = frameSeconds(STRIKE_FRAME);
  const crackle = (t: number) => (Math.sin(2 * Math.PI * 30 * t) > 0 ? 1 : 0.4);
  take.add(
    at,
    0.45,
    shaped(oscillator(slide(2600, 180, 0.3)), crackle, decay(9)),
    0,
    0.2
  );
  hit(take, at, noise);
}

/**
 * The cells burst from the crosshair outwards: the strike's wave needs
 * WAVE frames per unit, and a ring further out holds more cells, so the
 * pops grow denser until the wave reaches the strike's rim.
 */
function bursts(take: Take, rnd: () => number): void {
  const noise = noiseFrom(rnd);
  for (let cell = 0; cell < BURSTS; cell++) {
    const fromMiddle = STRIKE_RADIUS * Math.sqrt(rnd());
    const at = frameSeconds(STRIKE_FRAME + WAVE * fromMiddle);
    const pan = rnd() * 1.4 - 0.7;
    take.add(at, 0.03, shaped(sizzle(noise, 0.3), decay(90)), pan, 0.1);
    take.add(
      at,
      0.12,
      shaped(oscillator(slide(700 + 500 * rnd(), 120, 0.07)), decay(28)),
      pan,
      0.1
    );
  }
}

/** The first phage's tail contracts: light runs down into the cell. */
function injection(take: Take): void {
  const from = frameSeconds(HERO_FIRES.from);
  const seconds = frameSeconds(HERO_FIRES.to) - from;
  take.add(
    from,
    seconds,
    shaped(oscillator(slide(1800, 240, seconds)), swell(0.02, seconds, 0.08)),
    -0.2,
    0.07
  );
}

/** Sparks fly while the phages wither: high ticks, fewer and fainter. */
function sparks(take: Take, rnd: () => number): void {
  const from = frameSeconds(SPARKS.from);
  const seconds = (SPARKS.to - SPARKS.from) / FPS;
  for (const at of scatter(SPARKS.from, SPARKS.to, SPARK_EVERY, rnd)) {
    const f = 2500 + 2500 * rnd();
    take.add(
      at,
      0.06,
      shaped(
        oscillator(() => f),
        decay(70)
      ),
      rnd() * 1.6 - 0.8,
      0.04 * (1 - (0.7 * (at - from)) / seconds)
    );
  }
}
