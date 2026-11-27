/**
 * The voices the films' sounds are built from: oscillators whose pitch
 * slides, filtered noise and the envelopes that shape them. Each is a
 * `Sound` of ../../promo-video/synth, to be added to a track once: a voice
 * with a filter or a sliding pitch keeps its state from sample to sample.
 */
import { hz, RATE, Sound } from '../../promo-video/synth';

const TAU = 2 * Math.PI;

/** A value that changes with the seconds since a sound started. */
export type Curve = (t: number) => number;

/** The steady pitch of a MIDI note, as an oscillator's frequency. */
export function pitch(midi: number): Curve {
  const f = hz(midi);
  return () => f;
}

/** From `from` to `to` over `seconds`, in equal ratios (as a pitch slides), then steady. */
export function slide(from: number, to: number, seconds: number): Curve {
  return (t) => from * (to / from) ** Math.min(1, t / seconds);
}

/**
 * An oscillator whose frequency (Hz) may change while it sounds; `wave`
 * turns its phase into a cycle (a sine unless given).
 */
export function oscillator(
  frequency: Curve,
  wave: (phase: number) => number = Math.sin
): Sound {
  let phase = 0;
  return (t) => {
    phase += (TAU * frequency(t)) / RATE;
    return wave(phase);
  };
}

/** A sine with a share of its octave: the pads' and hums' soft tone. */
export function warm(phase: number): number {
  return Math.sin(phase) + 0.3 * Math.sin(2 * phase);
}

/** A sine with two overtones that fit no chord: struck glass or metal. */
export function glassy(phase: number): number {
  return (
    Math.sin(phase) + 0.4 * Math.sin(2.76 * phase) + 0.2 * Math.sin(5.4 * phase)
  );
}

/**
 * Noise through a low-pass filter. `openness` is the share of each new
 * sample let through: near 0 a dull rumble, 1 plain noise.
 */
export function hiss(noise: () => number, openness: Curve): Sound {
  let y = 0;
  return (t) => (y += (noise() - y) * openness(t));
}

/** What a low-pass of that openness takes away from noise: a thin, bright hiss. */
export function sizzle(noise: () => number, openness: number): Sound {
  let y = 0;
  return () => {
    const sample = noise();
    y += (sample - y) * openness;
    return sample - y;
  };
}

/** Falls from 1 by the factor e every `1 / rate` seconds. */
export function decay(rate: number): Curve {
  return (t) => Math.exp(-t * rate);
}

/** Rises over `attack` seconds, falls over the last `release` of `length`. */
export function swell(attack: number, length: number, release: number): Curve {
  return (t) => Math.max(0, Math.min(1, t / attack, (length - t) / release));
}

/** A sound made louder or softer over time by a curve. */
export function shaped(sound: Sound, ...curves: Curve[]): Sound {
  return (t) => {
    let value = sound(t);
    for (const curve of curves) {
      value *= curve(t);
    }
    return value;
  };
}
