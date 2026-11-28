/**
 * The heartbeat shot's sound. Here the heart is the rhythm: no drums, only
 * its thuds every 20 frames, the blood rushing with them, a bass note on
 * every surge and a pad that swells as the vessel wall does. After each
 * beat the thrown cells scatter as blips, and where orange eats into blue
 * cells slide down to it.
 */
import { seededRandom } from '../../../promo-video/synth';
import { heartbeat, heartLevel, noiseFrom, scatter, turns } from '../effects';
import { blip, Chord, pad, ShotScore, SHOT_FRAMES } from '../score';
import { FPS, frameSeconds, Take } from '../take';
import { decay, oscillator, pitch, shaped, warm } from '../voices';

const SEED = 72;

/* The frames of blender/scenes/heartbeat.py. */
/** `BEAT = 20`: frames from one heartbeat to the next, the first at frame 1. */
const BEAT_FRAMES = 20;
const FIRST_BEAT = 1;
/** Timeline: a beat throws the colonies furthest 4 frames after it starts. */
const THROWN_AFTER = 4;
/** Timeline, 41-80: the front flashes where cells change sides. */
const FRONT_FLASHES = { from: 41, to: 80 };
/** Timeline, 81-120: orange holds blue in a pincer and eats into it. */
const PINCER = { from: 81, to: 120 };

const BEAT_SECONDS = BEAT_FRAMES / FPS;
/** Frames between two cells changing sides, on average. */
const FLASH_EVERY = 3;
const PINCER_EVERY = 2;
/** Cells heard flying apart after a beat, over this many frames. */
const SCATTERED = 5;
const SCATTER_FRAMES = 8;
/** The pad's loudness between beats, and what a surge adds to it. */
const PAD_AT_REST = 0.5;
const PAD_SURGE = 0.6;

export const heartbeatShot: ShotScore = (take, chord) => {
  const rnd = seededRandom(SEED);
  const noise = noiseFrom(rnd);

  pad(take, chord, 0, take.seconds, pulse);
  drone(take, chord);
  for (const [beat, frame] of beatFrames().entries()) {
    const at = frameSeconds(frame);
    heartbeat(take, at, BEAT_SECONDS, noise, beat % 2 ? 0.3 : -0.3, 1.3);
    surgeNote(take, at, chord);
    thrownCells(take, frame, chord, rnd);
  }
  for (const [span, every] of [
    [FRONT_FLASHES, FLASH_EVERY],
    [PINCER, PINCER_EVERY],
  ] as const) {
    turns(take, scatter(span.from, span.to, every, rnd), chord, 'orange', rnd);
  }
};

/** The frames the heart beats on within the shot. */
function beatFrames(): number[] {
  const frames: number[] = [];
  for (let frame = FIRST_BEAT; frame <= SHOT_FRAMES; frame += BEAT_FRAMES) {
    frames.push(frame);
  }
  return frames;
}

/** How loud the pad is `t` seconds into the shot: it swells with every surge. */
function pulse(t: number): number {
  return (
    PAD_AT_REST + PAD_SURGE * heartLevel((t % BEAT_SECONDS) / BEAT_SECONDS)
  );
}

/** The vessel's depth: the chord's root and fifth, two octaves down. */
function drone(take: Take, chord: Chord): void {
  for (const note of [chord[0] - 24, chord[2] - 24]) {
    take.add(
      0,
      take.seconds,
      shaped(oscillator(pitch(note), warm), pulse),
      0,
      0.07
    );
  }
}

/** The chord's root an octave down on every surge: the heart plays the bass. */
function surgeNote(take: Take, at: number, chord: Chord): void {
  const ring = decay(4);
  take.add(
    at,
    BEAT_SECONDS,
    shaped(
      oscillator(pitch(chord[0] - 12), warm),
      (t) => heartLevel(t / BEAT_SECONDS) + 0.3 * ring(t)
    ),
    0,
    0.08
  );
}

/** A beat throws the swarm apart: chord notes scatter once it has. */
function thrownCells(
  take: Take,
  beatFrame: number,
  chord: Chord,
  rnd: () => number
): void {
  for (let cell = 0; cell < SCATTERED; cell++) {
    blip(
      take,
      frameSeconds(beatFrame + THROWN_AFTER + rnd() * SCATTER_FRAMES),
      chord[Math.floor(rnd() * chord.length)] + 24,
      rnd() * 1.6 - 0.8,
      0.05
    );
  }
}
