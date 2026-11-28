/**
 * The soundtrack of the Bacteria Wars Short, synthesised and seeded like
 * the gameplay promo's: a heartbeat in the blood vessel that quickens under
 * a low drone, a zap for every needle stab, a noise riser into the burst,
 * an impact on it, then 120 BPM in A minor (Am, F, a bar each) with kick,
 * bass and bacteria blips, and an A minor chord ringing out under the end
 * card.
 */
import { hz, Mix, seededRandom, Sound } from '../synth';
import { SHORT_TIMELINE } from './timeline';

const BEAT = 0.5;
const BAR = 4 * BEAT;
/** The groove's chords after the burst, a bar each; the last one rings. */
const CHORDS = [
  [57, 60, 64],
  [53, 57, 60],
  [57, 60, 64],
];

/** A kick: a sine falling from `from` Hz to `to` Hz. */
export function kick(from: number, to: number, decay: number): Sound {
  return (t) =>
    Math.sin(2 * Math.PI * (to + (from - to) * Math.exp(-t * 30)) * t) *
    Math.exp(-t * decay);
}

/** A 16-bit stereo WAV file of the Short's soundtrack. */
export function shortSoundtrack(): Buffer {
  const { duration, burst, stabs } = SHORT_TIMELINE;
  const mix = new Mix(duration);
  const rnd = seededRandom(23);
  const noise = () => rnd() * 2 - 1;

  addTension(mix, burst, noise);
  for (const [k, at] of stabs.entries()) {
    addStab(mix, at, k, rnd);
  }
  addRiser(mix, burst, noise);
  addImpact(mix, burst, noise);
  addGroove(mix, burst, duration, rnd);
  return mix.toWav();
}

/** Drone and a heartbeat that quickens from 66 to 132 BPM until the burst. */
export function addTension(mix: Mix, burst: number, noise: () => number): void {
  for (const [note, pan] of [
    [33, -0.3],
    [40, 0.3],
    [45, 0],
  ] as const) {
    for (const detune of [-0.1, 0.1]) {
      const f = hz(note + detune);
      mix.add(
        0,
        burst,
        (t) =>
          Math.min(1, t / 1.5) *
          (0.6 + 0.4 * (t / burst)) *
          (Math.sin(2 * Math.PI * f * t) +
            0.25 * Math.sin(6 * Math.PI * f * t)),
        pan,
        0.05
      );
    }
  }
  let t = 0.1;
  while (t < burst - 0.3) {
    const progress = t / burst;
    const interval = 60 / (66 + 66 * progress * progress);
    for (const [offset, gain] of [
      [0, 0.5],
      [0.16, 0.32],
    ] as const) {
      mix.add(t + offset, 0.3, kick(110, 42, 12), 0, gain * (0.6 + progress));
    }
    // A breath of blood rushing with each beat.
    mix.add(t, 0.25, (s) => noise() * Math.exp(-s * 18), 0, 0.03);
    t += interval;
  }
}

/** A needle stab: a short zap, higher with every stab, panned around. */
export function addStab(
  mix: Mix,
  at: number,
  k: number,
  rnd: () => number
): void {
  const f = hz(76 + k * 2);
  mix.add(
    at,
    0.22,
    (t) =>
      Math.sin(2 * Math.PI * f * (1 + 1.5 * Math.exp(-t * 60)) * t) *
      Math.exp(-t * 16) *
      (Math.sin(2 * Math.PI * 30 * t) > 0 ? 1 : 0.4),
    rnd() * 1.4 - 0.7,
    0.12
  );
}

/** Filtered noise swelling for two seconds into the burst. */
export function addRiser(mix: Mix, burst: number, noise: () => number): void {
  const length = 2;
  let y = 0;
  mix.add(
    burst - length,
    length - 0.04,
    (t) => {
      y += (noise() - y) * (0.01 + 0.3 * (t / length) ** 2);
      return y * (t / length) ** 3;
    },
    0,
    0.5
  );
}

/** The burst: a deep kick, a crash of noise and a bright chord stab. */
export function addImpact(mix: Mix, burst: number, noise: () => number): void {
  mix.add(burst, 1.2, kick(160, 32, 3.2), 0, 0.9);
  let y = 0;
  mix.add(
    burst,
    2.2,
    (t) => {
      y += (noise() - y) * 0.6;
      return y * Math.exp(-t * 2.2);
    },
    0,
    0.28
  );
  for (const [k, note] of [69, 72, 76, 81].entries()) {
    const f = hz(note);
    mix.add(
      burst,
      1.6,
      (t) =>
        (2 * ((f * t) % 1) - 1) * 0.5 * Math.exp(-t * 2.5) +
        Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 1.5),
      (k - 1.5) * 0.4,
      0.05
    );
  }
}

/** The groove after the burst, then the last chord ringing out. */
function addGroove(
  mix: Mix,
  burst: number,
  duration: number,
  rnd: () => number
): void {
  const grooveEnd = burst + (CHORDS.length - 1) * BAR;
  for (const [bar, chord] of CHORDS.entries()) {
    const t0 = burst + bar * BAR;
    const last = bar === CHORDS.length - 1;
    for (const [k, note] of chord.entries()) {
      for (const detune of [-0.15, 0.15]) {
        const f = hz(note + detune);
        mix.add(
          t0,
          last ? duration - t0 : BAR + 0.05,
          (t) =>
            Math.min(1, t / 0.3) *
            (last ? Math.exp(-t / 2) : Math.min(1, (BAR + 0.05 - t) / 0.3)) *
            (Math.sin(2 * Math.PI * f * t) +
              0.3 * Math.sin(4 * Math.PI * f * t)),
          (k - 1) * 0.4,
          0.05
        );
      }
    }
  }
  mix.add(grooveEnd, 1.2, kick(140, 38, 3.5), 0, 0.6);

  // By beat index: summing BEAT onto t0 drifts below the bar line.
  const beats = (CHORDS.length - 1) * (BAR / BEAT);
  for (let beat = 1; beat < beats; beat++) {
    const t0 = burst + beat * BEAT;
    const chord = CHORDS[Math.floor((beat * BEAT) / BAR)];
    mix.add(t0, 0.35, kick(135, 45, 9), 0, 0.55);
    const root = hz(chord[0] - 24);
    for (const offset of [0, BEAT / 2]) {
      mix.add(
        t0 + offset,
        0.22,
        (t) =>
          (2 * ((root * t) % 1) - 1) * Math.exp(-t * 9) * 0.8 +
          Math.sin(2 * Math.PI * root * t) * Math.exp(-t * 6),
        0,
        0.16
      );
    }
    mix.add(t0 + BEAT / 2, 0.05, () => rnd() * 2 - 1, 0.3, 0.05);
    if (beat % 2 === 1) {
      mix.add(t0, 0.18, (t) => (rnd() * 2 - 1) * Math.exp(-t * 22), -0.1, 0.12);
    }
    for (const offset of [0.25, 0.75]) {
      if (rnd() < 0.5) {
        const f = hz(
          chord[Math.floor(rnd() * chord.length)] + 12 + (rnd() < 0.3 ? 12 : 0)
        );
        mix.add(
          t0 + offset * BEAT,
          0.16,
          (t) =>
            Math.sin(2 * Math.PI * f * (1 + 0.4 * Math.exp(-t * 40)) * t) *
            Math.exp(-t * 26),
          rnd() * 1.2 - 0.6,
          0.11
        );
      }
    }
  }
}
