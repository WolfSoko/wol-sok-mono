/**
 * The music under the feature shots: one key, one tempo and a chord per
 * shot, so the reel, which starts a shot every SHOT_SPACING seconds, plays
 * as one piece. A minor, as the promo videos' soundtracks; two bars of four
 * beats fill the spacing exactly (106.7 BPM), and what a shot plays after
 * them, while the next one fades in, is only its tail.
 *
 * The layers are the promo soundtrack's (../../promo-video/audio.ts): a pad
 * of detuned sines, kick, bass, hats, claps and chord notes that blip like
 * bacteria. A shot lays the ones it needs over the beats it needs them on.
 */
import { kick } from '../../promo-video/short/short-audio';
import { hz } from '../../promo-video/synth';
import { REEL_FADE } from '../reel-cut';
import { filmSeconds, Take, Track } from './take';
import { Curve, decay, oscillator, shaped, slide } from './voices';

/** The frames of a feature shot: END in each shot's scene script. */
export const SHOT_FRAMES = 120;
/** From one shot's start in the reel to the next one's, in seconds. */
export const SHOT_SPACING = filmSeconds(SHOT_FRAMES) - REEL_FADE;
const BARS_PER_SHOT = 2;
const BEATS_PER_BAR = 4;
export const BAR = SHOT_SPACING / BARS_PER_SHOT;
export const BEAT = BAR / BEATS_PER_BAR;
/** The beats a shot plays before the next one starts. */
export const SHOT_BEATS = BARS_PER_SHOT * BEATS_PER_BAR;

/** Three MIDI notes, the root first. */
export type Chord = readonly [number, number, number];

export const A_MINOR: Chord = [57, 60, 64];
/** Am F C G Em Am: a chord per shot of the reel, home again on the end card. */
const PROGRESSION: readonly Chord[] = [
  A_MINOR,
  [53, 57, 60],
  [48, 52, 55],
  [55, 59, 62],
  [52, 55, 59],
  A_MINOR,
];

/** The chord of the shot at that place in the reel (0 is the first). */
export function chordOfShot(place: number): Chord {
  return PROGRESSION[place % PROGRESSION.length];
}

/**
 * A feature shot's sound: lays it over the shot's take, the music on the
 * chord the shot's place in the reel gives it.
 */
export type ShotScore = (take: Take, chord: Chord) => void;

/** A stretch of a shot in beats: from `from` up to, not including, `to`. */
export interface Beats {
  from: number;
  to: number;
}

/** The whole of a shot's two bars. */
export const BOTH_BARS: Beats = { from: 0, to: SHOT_BEATS };
export const FIRST_BAR: Beats = { from: 0, to: BEATS_PER_BAR };
export const SECOND_BAR: Beats = { from: BEATS_PER_BAR, to: SHOT_BEATS };

/** When each beat of a stretch starts: by index, since summing BEAT drifts. */
function starts({ from, to }: Beats): number[] {
  return Array.from({ length: to - from }, (_, k) => (from + k) * BEAT);
}

const PAD_GAIN = 0.045;
const PAD_ATTACK = 0.4;
/** How far the pad's two voices per note are tuned apart, in semitones. */
const PAD_DETUNE = 0.15;

/**
 * The chord as a pad from `from` seconds for `seconds`; `loudness` shapes it
 * over that time (steady unless given).
 */
export function pad(
  track: Track,
  chord: Chord,
  from: number,
  seconds: number,
  loudness: Curve = () => 1
): void {
  for (const [k, note] of chord.entries()) {
    for (const detune of [-PAD_DETUNE, PAD_DETUNE]) {
      const f = hz(note + detune);
      track.add(
        from,
        seconds,
        (t) =>
          Math.min(1, t / PAD_ATTACK) *
          loudness(t) *
          (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(4 * Math.PI * f * t)),
        (k - 1) * 0.4,
        PAD_GAIN
      );
    }
  }
}

/** A kick on every beat. */
export function kicks(track: Track, beats: Beats, gain = 0.55): void {
  for (const t0 of starts(beats)) {
    track.add(t0, 0.35, kick(135, 45, 9), 0, gain);
  }
}

/** Eighths on the chord's root, two octaves down: a saw and a sine. */
export function bassline(track: Track, chord: Chord, beats: Beats): void {
  const root = hz(chord[0] - 24);
  for (const t0 of starts(beats)) {
    for (const offset of [0, BEAT / 2]) {
      track.add(
        t0 + offset,
        0.22,
        (t) =>
          (2 * ((root * t) % 1) - 1) * Math.exp(-t * 9) * 0.8 +
          Math.sin(2 * Math.PI * root * t) * Math.exp(-t * 6),
        0,
        0.16
      );
    }
  }
}

/** A hat on every off-beat. */
export function hats(track: Track, noise: () => number, beats: Beats): void {
  for (const t0 of starts(beats)) {
    track.add(t0 + BEAT / 2, 0.05, noise, 0.3, 0.05);
  }
}

/** A clap on the second and fourth beat of each bar. */
export function claps(track: Track, noise: () => number, beats: Beats): void {
  for (const [k, t0] of starts(beats).entries()) {
    if ((beats.from + k) % 2 === 1) {
      track.add(t0, 0.18, (t) => noise() * Math.exp(-t * 22), -0.1, 0.12);
    }
  }
}

/** A chord note that blips like a bacterium: its pitch drops into place. */
export function blip(
  track: Track,
  at: number,
  note: number,
  pan: number,
  gain = 0.11
): void {
  const f = hz(note);
  const settle = decay(40);
  track.add(
    at,
    0.16,
    (t) =>
      Math.sin(2 * Math.PI * f * (1 + 0.4 * settle(t)) * t) * Math.exp(-t * 26),
    pan,
    gain
  );
}

/**
 * Bacteria: on the sixteenths between the beats a chord note blips with the
 * given chance, an octave or two up, panned around.
 */
export function blips(
  track: Track,
  chord: Chord,
  rnd: () => number,
  beats: Beats,
  chance = 0.45
): void {
  for (const t0 of starts(beats)) {
    for (const offset of [0.25, 0.75]) {
      if (rnd() < chance) {
        const note =
          chord[Math.floor(rnd() * chord.length)] + 12 + (rnd() < 0.3 ? 12 : 0);
        blip(track, t0 + offset * BEAT, note, rnd() * 1.2 - 0.6);
      }
    }
  }
}

/** A low sine that drops onto a bar line: the weight of a new section. */
export function downbeat(track: Track, at: number, chord: Chord): void {
  const root = hz(chord[0] - 24);
  const drop = oscillator(slide(root * 2, root, 0.06));
  track.add(at, 0.7, shaped(drop, decay(5)), 0, 0.3);
}
