/**
 * Where a film's sound is laid: its take, a stretch of a mix that starts
 * where the film does. A film alone is the whole mix; in the reel every
 * shot is a take of the same mix, so the six shots are one piece of music.
 */
import { Mix, Sound } from '../../promo-video/synth';

/*
 * `stage.reset()` in blender/microbe_kit/stage.py: every scene starts at
 * frame 1 and runs at 24 frames per second.
 */
export const FIRST_FRAME = 1;
export const FPS = 24;

/** How long a film of that many frames runs, in seconds. */
export function filmSeconds(frames: number): number {
  return frames / FPS;
}

/**
 * The second a frame comes on screen, counted from the film's first frame:
 * the scene scripts count frames from 1, so frame 1 is second 0.
 */
export function frameSeconds(frame: number): number {
  return (frame - FIRST_FRAME) / FPS;
}

/** What sounds are added to: a mix, or a film's take of one. */
export interface Track {
  add(
    t0: number,
    length: number,
    sound: Sound,
    pan?: number,
    gain?: number
  ): void;
}

/**
 * A film's stretch of a mix. What is added lands `start` seconds later, ends
 * with the film and fades over the film's last `tail` seconds: in a reel
 * that is the stretch the next shot fades in over, and its first bar covers
 * it.
 */
export class Take implements Track {
  public constructor(
    private readonly mix: Mix,
    private readonly start: number,
    public readonly seconds: number,
    private readonly tail: number
  ) {}

  /** Adds a sound `t0` seconds into the film, as `Mix.add` does into a mix. */
  public add(t0: number, length: number, sound: Sound, pan = 0, gain = 1) {
    const heard = Math.min(length, this.seconds - t0);
    if (heard <= 0) {
      return;
    }
    const tailStarts = this.seconds - this.tail;
    const fading: Sound = (t) =>
      sound(t) * Math.min(1, (this.seconds - t0 - t) / this.tail);
    this.mix.add(
      this.start + t0,
      heard,
      t0 + heard > tailStarts ? fading : sound,
      pan,
      gain
    );
  }
}
