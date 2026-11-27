/**
 * The sound effects more than one film needs: what colonies do in every
 * scene (cells change sides, a colony boosts, two things collide) and the
 * heart of the body scenes. Effects of one film alone stay in its file.
 */
import { kick } from '../../promo-video/short/short-audio';
import { hz } from '../../promo-video/synth';
import { Chord } from './score';
import { frameSeconds, Track } from './take';
import { decay, hiss, oscillator, shaped, slide, swell } from './voices';

/** A seeded source of noise in [-1, 1). */
export function noiseFrom(rnd: () => number): () => number {
  return () => rnd() * 2 - 1;
}

/**
 * The seconds of events scattered from one frame to another, on average
 * `every` frames apart (from half to one and a half times that, by `rnd`).
 */
export function scatter(
  fromFrame: number,
  toFrame: number,
  every: number,
  rnd: () => number
): number[] {
  const seconds: number[] = [];
  for (
    let frame = fromFrame + every * rnd();
    frame < toFrame;
    frame += every * (0.5 + rnd())
  ) {
    seconds.push(frameSeconds(frame));
  }
  return seconds;
}

/** A dull, low blow: two masses meet. */
export function thump(track: Track, at: number, gain = 0.35): void {
  track.add(
    at,
    0.6,
    shaped(
      oscillator(() => 55),
      decay(5)
    ),
    0,
    gain
  );
}

/** A hard hit: a deep kick under a crash of noise. `weight` scales both. */
export function hit(
  track: Track,
  at: number,
  noise: () => number,
  weight = 1
): void {
  track.add(at, 0.9, kick(150, 36, 4.5), 0, 0.6 * weight);
  track.add(
    at,
    0.9,
    shaped(
      hiss(noise, () => 0.5),
      decay(5)
    ),
    0,
    0.22 * weight
  );
}

/** Which way a cell that changes sides goes: orange sounds lower than blue. */
export type Winner = 'orange' | 'blue';

/** How far a turning cell's note slides, in semitones. */
const TURN_INTERVAL = 7;

/**
 * A cell changes sides: a chord note that slides down a fifth as orange
 * takes it, up as blue does, panned by chance.
 */
export function turn(
  track: Track,
  at: number,
  chord: Chord,
  winner: Winner,
  rnd: () => number,
  gain = 0.09
): void {
  const note = chord[Math.floor(rnd() * chord.length)] + 24;
  const interval = winner === 'orange' ? -TURN_INTERVAL : TURN_INTERVAL;
  track.add(
    at,
    0.14,
    shaped(oscillator(slide(hz(note), hz(note + interval), 0.05)), decay(30)),
    rnd() * 1.4 - 0.7,
    gain
  );
}

/** Cells change sides at each of the given seconds. */
export function turns(
  track: Track,
  seconds: number[],
  chord: Chord,
  winner: Winner,
  rnd: () => number
): void {
  for (const at of seconds) {
    turn(track, at, chord, winner, rnd);
  }
}

/**
 * A colony boosts: a kick, a whine that shoots up and a jet of noise that
 * opens at once and thins out over `seconds`.
 */
export function boost(
  track: Track,
  at: number,
  seconds: number,
  noise: () => number,
  whine: number
): void {
  track.add(at, 0.5, kick(170, 50, 7), 0, 0.5);
  track.add(
    at,
    0.6,
    shaped(oscillator(slide(whine, whine * 6, 0.3)), swell(0.02, 0.6, 0.4)),
    0,
    0.07
  );
  track.add(
    at,
    seconds,
    shaped(
      hiss(noise, (t) => 0.04 + 0.4 * Math.exp(-t * 2.5)),
      swell(0.06, seconds, seconds * 0.8)
    ),
    0,
    0.3
  );
}

/**
 * Where in a beat the heart surges and echoes, as shares of the beat, how
 * wide each is and how strong the echo: `Heartbeat.level` in
 * blender/microbe_kit/effects.py.
 */
const SURGE = { at: 0.12, width: 0.07 };
const ECHO = { at: 0.34, width: 0.06, strength: 0.45 };

/** How hard the heart pushes at a share of its beat: about 1 at the surge. */
export function heartLevel(phase: number): number {
  return (
    Math.exp(-(((phase - SURGE.at) / SURGE.width) ** 2)) +
    ECHO.strength * Math.exp(-(((phase - ECHO.at) / ECHO.width) ** 2))
  );
}

/**
 * One beat of the heart from `at` seconds: a low thud on the surge, a
 * softer one on its echo, and the blood rushing with both. The second thud
 * is softer by the root of the echo's strength: a heart's second sound is
 * nearly as loud as its first, however much weaker it pushes.
 */
export function heartbeat(
  track: Track,
  at: number,
  beatSeconds: number,
  noise: () => number,
  pan = 0,
  gain = 1
): void {
  track.add(at + SURGE.at * beatSeconds, 0.3, kick(110, 42, 12), 0, 0.5 * gain);
  track.add(
    at + ECHO.at * beatSeconds,
    0.3,
    kick(95, 40, 14),
    0,
    0.5 * gain * Math.sqrt(ECHO.strength)
  );
  track.add(
    at,
    beatSeconds,
    shaped(
      hiss(noise, () => 0.1),
      (t) => heartLevel(t / beatSeconds)
    ),
    pan,
    0.3 * gain
  );
}
