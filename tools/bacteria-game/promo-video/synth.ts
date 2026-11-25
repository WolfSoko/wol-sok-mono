/**
 * The building blocks of the promo videos' synthesised soundtracks: a stereo
 * mix that sounds are added to at a time, a seeded random source, so every
 * run writes the same file, and the 16-bit WAV the mix ends up in.
 */

export const RATE = 44100;

/** A sound as a function of the seconds since it started. */
export type Sound = (t: number) => number;

/** The frequency of a MIDI note, A4 (69) at 440 Hz. */
export function hz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** A seeded pseudo-random source in [0, 1): the same seed, the same row. */
export function seededRandom(seed: number): () => number {
  let state = seed;
  return () => ((state = (state * 16807) % 2147483647) - 1) / 2147483646;
}

/** A stereo mix of the given length. */
export class Mix {
  public readonly length: number;
  private readonly left: Float32Array;
  private readonly right: Float32Array;

  public constructor(public readonly seconds: number) {
    this.length = Math.round(RATE * seconds);
    this.left = new Float32Array(this.length);
    this.right = new Float32Array(this.length);
  }

  /**
   * Adds a sound from `t0` for `length` seconds, cut at the mix's ends,
   * panned from -1 (left) to 1 (right).
   */
  public add(t0: number, length: number, sound: Sound, pan = 0, gain = 1) {
    const i0 = Math.round(t0 * RATE);
    for (
      let i = Math.max(0, -i0);
      i < length * RATE && i0 + i < this.length;
      i++
    ) {
      const v = sound(i / RATE) * gain;
      this.left[i0 + i] += v * (1 - Math.max(0, pan));
      this.right[i0 + i] += v * (1 + Math.min(0, pan));
    }
  }

  /**
   * The mix as a 16-bit stereo WAV file, faded out over its last second and
   * normalised to -1 dBFS.
   */
  public toWav(): Buffer {
    const n = this.length;
    const { left, right } = this;
    let peak = 0;
    for (let i = 0; i < n; i++) {
      const fadeOut = Math.min(1, (n - i) / RATE);
      left[i] *= fadeOut;
      right[i] *= fadeOut;
      peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
    }
    const scale = (0.89 / peak) * 32767;
    const wav = Buffer.alloc(44 + n * 4);
    wav.write('RIFF', 0);
    wav.writeUInt32LE(36 + n * 4, 4);
    wav.write('WAVEfmt ', 8);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(2, 22);
    wav.writeUInt32LE(RATE, 24);
    wav.writeUInt32LE(RATE * 4, 28);
    wav.writeUInt16LE(4, 32);
    wav.writeUInt16LE(16, 34);
    wav.write('data', 36);
    wav.writeUInt32LE(n * 4, 40);
    for (let i = 0; i < n; i++) {
      wav.writeInt16LE(Math.round(left[i] * scale), 44 + i * 4);
      wav.writeInt16LE(Math.round(right[i] * scale), 46 + i * 4);
    }
    return wav;
  }
}
