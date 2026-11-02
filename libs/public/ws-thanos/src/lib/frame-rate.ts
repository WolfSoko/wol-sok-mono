/**
 * The simulation was tuned at this frame rate. Whatever is applied once per frame
 * is scaled by the frame's length relative to it, so the effect looks the same on a 120 Hz screen.
 */
export const FRAME_RATE = 60;

/**
 * the fade for one frame of the given length, fade is the fade for a frame at FRAME_RATE.
 * A fade below 0, past the end of the animation, fades out completely.
 */
export function frameFade(fade: number, deltaTSec: number): number {
  return Math.pow(Math.max(0, fade), deltaTSec * FRAME_RATE);
}
