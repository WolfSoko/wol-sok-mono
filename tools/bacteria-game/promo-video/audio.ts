/**
 * The soundtrack of the promo video, synthesised: 120 BPM in A minor (Am F
 * C G, a bar each), so every scene change falls on a beat. A pad swells in
 * under the title, kick, bass, hats and claps carry the clips, chord notes
 * blip like bacteria, a noise riser leads into each scene, and the last
 * chord rings out under the end card. Seeded, so every run writes the same
 * file.
 */
import { hz, Mix, seededRandom } from './synth';

const BEAT = 0.5;
/** Am F C G, one bar (two seconds) each. */
const CHORDS = [
  [57, 60, 64],
  [53, 57, 60],
  [48, 52, 55],
  [55, 59, 62],
];

/** A 16-bit stereo WAV file of the soundtrack. */
export function soundtrack(
  durationMs: number,
  sceneStartsMs: number[],
  grooveMs: [number, number]
): Buffer {
  const duration = durationMs / 1000;
  const mix = new Mix(duration);
  const rnd = seededRandom(11);
  const add = mix.add.bind(mix);
  const chordAt = (t: number) => CHORDS[Math.floor(t / 2) % CHORDS.length];
  const [grooveStart, grooveEnd] = grooveMs.map((ms) => ms / 1000);
  const groove = (t: number) => t >= grooveStart && t < grooveEnd;

  // Pad: detuned sines; after the groove the chord rings out.
  for (let bar = 0; bar * 2 < duration; bar++) {
    const t0 = bar * 2;
    const last = t0 >= grooveEnd;
    for (const [k, note] of chordAt(t0).entries()) {
      for (const detune of [-0.15, 0.15]) {
        const f = hz(note + detune);
        add(
          t0,
          last ? duration - t0 : 2.05,
          (t) =>
            Math.min(1, t / 0.4) *
            (last ? Math.exp(-t / 2.2) : Math.min(1, (2.05 - t) / 0.3)) *
            (Math.sin(2 * Math.PI * f * t) +
              0.3 * Math.sin(4 * Math.PI * f * t)),
          (k - 1) * 0.4,
          0.045 * Math.min(1, (t0 + 1) / 3)
        );
      }
    }
  }

  for (let beat = 0; beat * BEAT < duration; beat++) {
    const t0 = beat * BEAT;
    if (!groove(t0)) {
      continue;
    }
    // Kick
    add(
      t0,
      0.35,
      (t) =>
        Math.sin(2 * Math.PI * (45 + 90 * Math.exp(-t * 30)) * t) *
        Math.exp(-t * 9),
      0,
      0.55
    );
    // Bass: eighths on the root, a saw and a sine.
    const root = hz(chordAt(t0)[0] - 24);
    for (const offset of [0, BEAT / 2]) {
      add(
        t0 + offset,
        0.22,
        (t) =>
          (2 * ((root * t) % 1) - 1) * Math.exp(-t * 9) * 0.8 +
          Math.sin(2 * Math.PI * root * t) * Math.exp(-t * 6),
        0,
        0.16
      );
    }
    // Hats on the off-beats, a clap on 2 and 4.
    add(t0 + BEAT / 2, 0.05, () => rnd() * 2 - 1, 0.3, 0.05);
    if (beat % 2 === 1) {
      add(t0, 0.18, (t) => (rnd() * 2 - 1) * Math.exp(-t * 22), -0.1, 0.12);
    }
    // Bacteria: a chord note blips now and then, panned around.
    for (const offset of [0.25, 0.75]) {
      if (rnd() < 0.45) {
        const chord = chordAt(t0);
        const f = hz(
          chord[Math.floor(rnd() * chord.length)] + 12 + (rnd() < 0.3 ? 12 : 0)
        );
        add(
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

  // A riser of filtered noise into each scene, a low thump on it.
  for (const start of sceneStartsMs.map((ms) => ms / 1000)) {
    let y = 0;
    add(
      start - 0.9,
      0.95,
      (t) => {
        y += (rnd() * 2 - 1 - y) * (0.02 + 0.25 * t);
        return y * (t / 0.9) ** 2;
      },
      0,
      0.35
    );
    add(
      start,
      0.6,
      (t) => Math.sin(2 * Math.PI * 55 * t) * Math.exp(-t * 5),
      0,
      0.35
    );
  }

  return mix.toWav();
}
