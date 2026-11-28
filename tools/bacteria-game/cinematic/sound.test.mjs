/**
 * The films' soundtracks: every film has one, of the film's length, never
 * silent and the same on every run, and the reel's starts every shot on a
 * bar line of the music and runs through the cuts. Run by `npx nx test
 * tools` from the workspace root.
 *
 * The sound modules are loaded through tsx, as the tools run them: they
 * build on the promo videos' synthesiser (../promo-video/synth.ts), which is
 * written for tsx, not for Node's type stripping.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { require as requireWithTsx } from 'tsx/cjs/api';
import { REEL_FADE, reelLength, reelStarts } from './reel-cut.ts';
import { DEFAULT_SCENE, sceneScript, shots } from './scenes.ts';

/**
 * @typedef {{ frames: number, fps: number, wav: () => Buffer }} Soundtrack
 * @type {{
 *   soundtrackOf: (scene: string) => Soundtrack,
 *   reelSoundtrack: (scenes: string[], lengths: number[]) => Buffer,
 * }}
 */
const { soundtrackOf, reelSoundtrack } = requireWithTsx(
  './sound/soundtracks.ts',
  import.meta.url
);
/** @type {{ SHOT_SPACING: number, BAR: number }} */
const { SHOT_SPACING, BAR } = requireWithTsx(
  './sound/score.ts',
  import.meta.url
);

const RATE = 44100;
const WAV_HEADER = 44;
const BYTES_PER_SAMPLE = 4;
/** Half a second: no stretch of that length may be silent. */
const STRETCH = RATE / 2;
/** A stretch quieter than this (dBFS, RMS) counts as silent. */
const SILENCE = -40;

/** Every film with a scene script: the shots of the reel and the first cinematic. */
const FILMS = [...shots().reel, DEFAULT_SCENE];

/** Each film's soundtrack, synthesised once for all tests. */
const wavs = new Map(FILMS.map((scene) => [scene, soundtrackOf(scene).wav()]));

/** The frames a scene script gives its film: its `END`. */
function sceneFrames(scene) {
  const end = /^END = (\d+)$/m.exec(readFileSync(sceneScript(scene), 'utf8'));
  assert.ok(end, `${scene} names no END`);
  return Number(end[1]);
}

function samples(wav) {
  return (wav.length - WAV_HEADER) / BYTES_PER_SAMPLE;
}

/** The level (dBFS, RMS over both channels) of each stretch of a WAV. */
function levels(wav) {
  const result = [];
  for (let start = 0; start < samples(wav); start += STRETCH) {
    const end = Math.min(samples(wav), start + STRETCH);
    let squares = 0;
    for (let i = start; i < end; i++) {
      const at = WAV_HEADER + i * BYTES_PER_SAMPLE;
      const left = wav.readInt16LE(at) / 32768;
      const right = wav.readInt16LE(at + 2) / 32768;
      squares += (left * left + right * right) / 2;
    }
    result.push(10 * Math.log10(squares / (end - start)));
  }
  return result;
}

/** Fails for a stretch that is silent; the last one fades out and is left out. */
function assertNeverSilent(wav, name) {
  for (const [k, level] of levels(wav).slice(0, -1).entries()) {
    assert.ok(
      level > SILENCE,
      `${name} is silent from ${k / 2} s: ${level.toFixed(0)} dBFS`
    );
  }
}

void describe('the soundtracks of the films', () => {
  void it('every shot of the reel and the first cinematic has one', () => {
    for (const scene of FILMS) {
      assert.doesNotThrow(() => soundtrackOf(scene), scene);
    }
  });

  void it('a scene without a soundtrack is refused, not left silent', () => {
    assert.throws(() => soundtrackOf('no_such_scene'), /no soundtrack/);
  });

  void it('a soundtrack has the length of the film its scene script builds', () => {
    for (const scene of FILMS) {
      const { frames, fps } = soundtrackOf(scene);
      assert.equal(frames, sceneFrames(scene), scene);
      assert.equal(samples(wavs.get(scene)), (frames / fps) * RATE, scene);
    }
  });

  void it('no stretch of a soundtrack is silent', () => {
    for (const scene of FILMS) {
      assertNeverSilent(wavs.get(scene), scene);
    }
  });

  void it('a soundtrack is the same on every run', () => {
    for (const scene of FILMS) {
      assert.ok(soundtrackOf(scene).wav().equals(wavs.get(scene)), scene);
    }
  });
});

void describe("the reel's soundtrack", () => {
  const scenes = shots().reel;
  const lengths = scenes.map((scene) => {
    const { frames, fps } = soundtrackOf(scene);
    return frames / fps;
  });

  void it('every shot starts on a bar line of the music', () => {
    assert.equal(SHOT_SPACING % BAR, 0);
    for (const start of reelStarts(lengths, REEL_FADE)) {
      assert.equal(start % SHOT_SPACING, 0);
    }
  });

  void it('it runs as long as its films cut together, and through the cut', () => {
    // Two shots hold a cut; all six would only take longer to synthesise.
    const [cutScenes, cutLengths] = [scenes.slice(0, 2), lengths.slice(0, 2)];
    const wav = reelSoundtrack(cutScenes, cutLengths);
    assert.equal(samples(wav), reelLength(cutLengths, REEL_FADE) * RATE);
    assertNeverSilent(wav, 'the reel');
  });

  void it('a film that is no shot of the reel has no place in it', () => {
    assert.throws(
      () => reelSoundtrack([...scenes, DEFAULT_SCENE], [...lengths, 5]),
      /the reel cannot play/
    );
  });
});
