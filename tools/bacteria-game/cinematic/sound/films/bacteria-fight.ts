/**
 * The first cinematic's sound, with the sounds of the Short that is cut
 * from it (../../../promo-video/short/short-audio.ts): a heartbeat that
 * quickens under a drone, a zap for every needle stab, a riser into the
 * burst and the impact on it. Where the Short goes into its groove, the
 * film stays in the vessel: the burst's chord rings on and the heart, calm
 * again, pushes the blood on.
 */
import {
  addImpact,
  addRiser,
  addStab,
  addTension,
} from '../../../promo-video/short/short-audio';
import { Mix, seededRandom } from '../../../promo-video/synth';
import { heartbeat, noiseFrom } from '../effects';
import { A_MINOR, pad } from '../score';
import { FPS, filmSeconds, frameSeconds } from '../take';
import { decay } from '../voices';

const SEED = 161;

/* The frames of blender/scenes/bacteria_fight.py. */
export const BACTERIA_FIGHT_FRAMES = 320;
/** `BURST = 161`: the coccus bursts. */
const BURST = 161;
/** `OFFSETS`: each attacker strikes a little later than the one before. */
const ATTACKER_OFFSETS = [0, 6, 12];
/** `animate_attacker`: the frames the first attacker's needles hit, both rounds. */
const FIRST_ATTACKER_HITS = [61, 82, 110, 136, 150];
/** `SETTLE = 220`: `effects.Heartbeat(start=SETTLE)` pushes the blood on from here. */
const HEART_STARTS = 220;
/** `Heartbeat`'s beat in blender/microbe_kit/effects.py: 20 frames, 72 a minute. */
const HEART_BEAT_FRAMES = 20;

/** The Short's zaps climb by its stabs' index, to this one for its last. */
const HIGHEST_STAB = 8;
/** The burst's chord rings on this loud, and fades to a third in these seconds. */
const AFTERMATH_PAD = 1.6;
const AFTERMATH_FADE = 4;

/** Lays the film's sound onto a mix of the film's length. */
export function bacteriaFight(mix: Mix): void {
  const rnd = seededRandom(SEED);
  const noise = noiseFrom(rnd);
  const burst = frameSeconds(BURST);

  addTension(mix, burst, noise);
  const stabs = stabFrames();
  for (const [k, frame] of stabs.entries()) {
    const climb = (k * HIGHEST_STAB) / (stabs.length - 1);
    addStab(mix, frameSeconds(frame), climb, rnd);
  }
  addRiser(mix, burst, noise);
  addImpact(mix, burst, noise);
  aftermath(mix, burst, noise);
}

/** Every needle hit before the burst, in order. */
function stabFrames(): number[] {
  return FIRST_ATTACKER_HITS.flatMap((hit) =>
    ATTACKER_OFFSETS.map((offset) => hit + offset)
  )
    .filter((frame) => frame < BURST)
    .sort((a, b) => a - b);
}

/** After the burst: its chord rings on, and the heart pushes the blood on. */
function aftermath(mix: Mix, burst: number, noise: () => number): void {
  const end = filmSeconds(BACTERIA_FIGHT_FRAMES);
  const fading = decay(Math.log(3) / AFTERMATH_FADE);
  pad(mix, A_MINOR, burst, end - burst, (t) => AFTERMATH_PAD * fading(t));
  for (
    let frame = HEART_STARTS;
    frame < BACTERIA_FIGHT_FRAMES;
    frame += HEART_BEAT_FRAMES
  ) {
    heartbeat(mix, frameSeconds(frame), HEART_BEAT_FRAMES / FPS, noise);
  }
}
