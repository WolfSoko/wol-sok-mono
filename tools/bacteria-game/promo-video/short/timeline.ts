/**
 * When things happen in the Short, in seconds: what the Blender animation
 * shows (the burst), and when the cards and the music follow it.
 */
export const SHORT_TIMELINE = {
  /** The source runs 320 frames at 24 fps. */
  duration: 320 / 24,
  /** The frame where the coccus bursts into light. */
  burst: 161 / 24,
  /** The needles' stabs before it, as they reach the membrane. */
  stabs: [2.5, 3.35, 4.0, 4.55, 5.05, 5.5, 5.9, 6.2, 6.45],
  titleIn: 0.2,
  taglineIn: 1.0,
  /** One bar of the groove after the burst. */
  endCardIn: 161 / 24 + 2,
} as const;
