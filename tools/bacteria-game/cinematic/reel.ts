/**
 * Cuts the feature reel of apps/bacteria-wars-cinematic: the films of the
 * shots listed in its shots.json, in that order, each fading into the next,
 * as renders/bacteria-wars-reel.mp4 (no text: an intro or the footage for an
 * ad, to be captioned per language).
 *
 * The reel has one soundtrack of its own, not the films' six faded into
 * each other: every shot's sound laid where the shot starts, on the chord
 * of its place, so the music runs through (sound/soundtracks.ts). It is
 * written to dist/bacteria-wars-cinematic/reel/bacteria-wars-reel.wav.
 *
 * Every shot must have been rendered first (renders/<name>.mp4, see
 * render.ts). Needs an ffmpeg with libx264 (see ../promo-video/ffmpeg.ts).
 * Run `npx nx run bacteria-wars-cinematic:reel`; `-- --films <folder>` takes
 * the shots' films from another folder than renders, `--out <file>` writes
 * the reel elsewhere.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { cutReel, describeFilm, pictureOf, pictureSeconds } from './film';
import { REEL_FADE } from './reel-cut';
import { rendersDir, sceneName, shots, workDir } from './scenes';
import { reelSoundtrack } from './sound/soundtracks';

const REEL = 'bacteria-wars-reel';

function main(): void {
  const { values } = parseArgs({
    options: {
      films: { type: 'string', default: rendersDir },
      out: { type: 'string', default: join(rendersDir, `${REEL}.mp4`) },
    },
  });
  const scenes = shots().reel;
  if (scenes.length < 2) {
    throw new Error('shots.json lists fewer than two shots: nothing to cut');
  }
  const films = scenes.map((scene) =>
    join(resolve(values.films), `${sceneName(scene)}.mp4`)
  );
  const missing = films.filter((film) => !existsSync(film));
  if (missing.length) {
    throw new Error(`Render these shots first:\n${missing.join('\n')}`);
  }
  const lengths = films.map((film) => pictureSeconds(pictureOf(film)));
  mkdirSync(workDir('reel'), { recursive: true });
  const wav = join(workDir('reel'), `${REEL}.wav`);
  writeFileSync(wav, reelSoundtrack(scenes, lengths, REEL_FADE));
  const out = resolve(values.out);
  cutReel(films, lengths, REEL_FADE, wav, out);
  console.log(`${films.length} shots: ${describeFilm(out)}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
