/**
 * The soundtracks of the films of apps/bacteria-wars-cinematic, synthesised
 * and seeded: every run writes the same sound. Each film has one of its own
 * (films/), with effects on the frames its scene script gives; a scene
 * without one is refused, so no film comes out silent.
 *
 * The feature shots share key, tempo and a chord progression (score.ts), a
 * chord per shot by its place in shots.json, so the reel's soundtrack is not
 * six soundtracks faded into each other but one mix with every shot's sound
 * laid at its start.
 */
import { Mix } from '../../promo-video/synth';
import { REEL_FADE, reelLength, reelStarts } from '../reel-cut';
import { sceneName, shots } from '../scenes';
import { BACTERIA_FIGHT_FRAMES, bacteriaFight } from './films/bacteria-fight';
import { dishDuel } from './films/dish-duel';
import { feeding } from './films/feeding';
import { gateBoost } from './films/gate-boost';
import { heartbeatShot } from './films/heartbeat';
import { phageStrike } from './films/phage-strike';
import { titleDish } from './films/title-dish';
import { chordOfShot, SHOT_FRAMES, ShotScore } from './score';
import { filmSeconds, FPS, Take } from './take';

/** The first cinematic: a film of its own length and music, no shot of the reel. */
const FIRST_CINEMATIC = 'bacteria-fight';

/** The feature shots' scores, by the name of their scene (`sceneName()`). */
const SHOT_SCORES = new Map<string, ShotScore>([
  ['dish-duel', dishDuel],
  ['feeding', feeding],
  ['gate-boost', gateBoost],
  ['phage-strike', phageStrike],
  ['heartbeat', heartbeatShot],
  ['title-dish', titleDish],
]);

export interface Soundtrack {
  /** The frames of the film it is written for: END of its scene script. */
  frames: number;
  /** Frames per second of that film. */
  fps: number;
  /** The soundtrack as a 16-bit stereo WAV file of the film's length. */
  wav(): Buffer;
}

/**
 * The soundtrack of a scene, named as its script (`dish_duel`) or its film
 * (`dish-duel`). Throws for a scene that has none.
 */
export function soundtrackOf(scene: string): Soundtrack {
  const name = sceneName(scene);
  if (name === FIRST_CINEMATIC) {
    return film(BACTERIA_FIGHT_FRAMES, bacteriaFight);
  }
  const score = SHOT_SCORES.get(name);
  if (!score) {
    throw new Error(
      `no soundtrack for the scene ${name}: every film has sound, so write ` +
        'one in tools/bacteria-game/cinematic/sound/films and list it in ' +
        'sound/soundtracks.ts'
    );
  }
  return film(SHOT_FRAMES, (mix) =>
    score(
      new Take(mix, 0, mix.seconds, REEL_FADE),
      chordOfShot(placeInReel(name))
    )
  );
}

/**
 * The reel's soundtrack: each shot's sound laid where the shot starts when
 * films of the given lengths (seconds) fade into each other over `fade`
 * seconds, on the chord of its place, as one 16-bit stereo WAV file.
 */
export function reelSoundtrack(
  scenes: string[],
  lengths: number[],
  fade: number = REEL_FADE
): Buffer {
  const scores = scenes.map(reelScore);
  const starts = reelStarts(lengths, fade);
  const mix = new Mix(reelLength(lengths, fade));
  for (const [place, score] of scores.entries()) {
    score(
      new Take(mix, starts[place], lengths[place], fade),
      chordOfShot(place)
    );
  }
  return mix.toWav();
}

/** The score of a shot of the reel; a film written for itself alone is refused. */
function reelScore(scene: string): ShotScore {
  const score = SHOT_SCORES.get(sceneName(scene));
  if (!score) {
    throw new Error(
      `the reel cannot play ${scene}: only the feature shots' soundtracks ` +
        'share its key and tempo (sound/score.ts)'
    );
  }
  return score;
}

function film(frames: number, compose: (mix: Mix) => void): Soundtrack {
  return {
    frames,
    fps: FPS,
    wav: () => {
      const mix = new Mix(filmSeconds(frames));
      compose(mix);
      return mix.toWav();
    },
  };
}

/** A shot's place in shots.json; one that is not in the reel plays on its first chord. */
function placeInReel(name: string): number {
  return Math.max(0, shots().reel.map(sceneName).indexOf(name));
}
