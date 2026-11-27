/**
 * Renders a scene of apps/bacteria-wars-cinematic on the Flamenco render
 * farm (farm.ts: inside the tailnet, so this runs there, never in CI) and
 * keeps the result under apps/bacteria-wars-cinematic/renders.
 *
 * A film (the default):
 * 1. Scene: builds the .blend from a scene script (`--scene`, by name such
 *    as `dish_duel` or as a path; default the first cinematic) or takes one
 *    (`--blend`), and writes the farm's render settings into a copy
 *    (blender/render/farm_settings.py).
 * 2. Farm: renders the frames, a few per task.
 * 3. Video: gathers the frames into dist/bacteria-wars-cinematic/<name>/frames
 *    (frames of earlier runs stay, so `--frames 161-320` re-renders a part)
 *    and, once every frame of the scene is there, encodes renders/<name>.mp4
 *    (H.264, CRF 18) with the scene's sound.
 *
 * Every film has sound: the scene's synthesised soundtrack
 * (sound/soundtracks.ts), written to dist/bacteria-wars-cinematic/<name>/<name>.wav
 * and laid under the picture (film.ts). A scene without a soundtrack is
 * refused before anything is rendered.
 *
 * A still (`--still`): the scene's poster frame alone, at 3840 x 2160 with
 * twice the samples, kept lossless in dist/bacteria-wars-cinematic/<name>/still
 * and as renders/<name>.jpg.
 *
 * `--collect <run>` skips the farm: it takes the frames of a run the farm has
 * already rendered (`<name>-<timestamp>`, printed when the job was submitted)
 * from the shared storage, for a wait that was cut off while the job went on.
 *
 * Two ways need neither the farm, its storage nor Blender:
 * - `--encode` encodes renders/<name>.mp4 again from the frames already in
 *   dist/bacteria-wars-cinematic/<name>/frames, with the scene's sound: for a
 *   film encoded before it had sound, or after its soundtrack changed.
 * - `--dub` lays the scene's sound onto renders/<name>.mp4 as it is, for a
 *   film whose frames are gone: the video stream is copied, not encoded
 *   again, and sound the film had is replaced.
 *
 * Environment: FLAMENCO_MANAGER and FLAMENCO_STORAGE (farm.ts), BLENDER
 * (scenes.ts), FFMPEG (../promo-video/ffmpeg.ts).
 *
 * Run `npx nx run bacteria-wars-cinematic:render`, with `-- --scene
 * dish_duel`, `--frames 1-24`, `--blend <file>`, `--name <name>`, `--still`,
 * `--collect <run>`, `--encode` or `--dub`.
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { FarmRender, frameName, renderOnFarm, runFrames } from './farm';
import {
  describeFilm,
  dubFilm,
  encodeFilm,
  Picture,
  pictureOf,
  runFfmpeg,
  writeSoundtrack,
} from './film';
import {
  blender,
  buildScene,
  DEFAULT_SCENE,
  projectDir,
  rendersDir,
  sceneName,
  sceneScript,
  workDir,
} from './scenes';
import { Soundtrack, soundtrackOf } from './sound/soundtracks';
import { FIRST_FRAME } from './sound/take';

/** JPEG quality of a still on ffmpeg's scale (2 is visually lossless). */
const STILL_QUALITY = '2';

interface FarmScene {
  /** The copy of the scene with the farm's settings. */
  blend: string;
  first: number;
  last: number;
  fps: number;
  poster: number;
}

/** A film to encode: the name it is kept under, and the sound of its scene. */
interface Film {
  name: string;
  soundtrack: Soundtrack;
}

/** "161-320" -> [161, 320]. */
function frameRange(text: string): [number, number] {
  const match = /^(\d+)-(\d+)$/.exec(text);
  if (!match) {
    throw new Error(`--frames takes <first>-<last>, not ${text}`);
  }
  return [Number(match[1]), Number(match[2])];
}

/** Writes the farm's settings into a copy of the scene and reads its frames. */
function prepareForFarm(
  blend: string,
  farmBlend: string,
  still: boolean
): FarmScene {
  const settings = blender([
    blend,
    '--python',
    join(projectDir, 'blender/render/farm_settings.py'),
    '--',
    farmBlend,
    ...(still ? ['still'] : []),
  ]);
  const info = /FRAMES (\d+) (\d+) FPS (\d+) POSTER (\d+)/.exec(settings);
  if (!info) {
    throw new Error(`farm_settings.py printed no frame range:\n${settings}`);
  }
  const [first, last, fps, poster] = info.slice(1).map(Number);
  return { blend: farmBlend, first, last, fps, poster };
}

/** Where the frames are: the farm renders them, or a run it has rendered is named. */
type Frames = (render: FarmRender) => Promise<string>;

/** Renders the poster frame large and keeps it as PNG (dist) and JPEG (renders). */
async function renderStill(
  name: string,
  scene: FarmScene,
  frames: Frames
): Promise<void> {
  const stillDir = join(workDir(name), 'still');
  mkdirSync(stillDir, { recursive: true });
  const farmFrames = await frames({
    name: `${name}-still`,
    blend: scene.blend,
    first: scene.poster,
    last: scene.poster,
    fps: scene.fps,
  });
  const png = join(stillDir, `${name}.png`);
  copyFileSync(join(farmFrames, frameName(scene.poster)), png);
  const out = join(rendersDir, `${name}.jpg`);
  runFfmpeg(['-i', png, '-q:v', STILL_QUALITY, out]);
  console.log(`${out}: frame ${scene.poster} (lossless: ${png})`);
}

function framesDir(name: string): string {
  return join(workDir(name), 'frames');
}

function filmFile(name: string): string {
  return join(rendersDir, `${name}.mp4`);
}

function soundtrackFile(name: string): string {
  return join(workDir(name), `${name}.wav`);
}

/** The frames from `first` to `last` that are not among the film's gathered ones. */
function missingFrames(name: string, first: number, last: number): number[] {
  const missing = [];
  for (let frame = first; frame <= last; frame++) {
    if (!existsSync(join(framesDir(name), frameName(frame)))) {
      missing.push(frame);
    }
  }
  return missing;
}

/** Encodes the film from its gathered frames, `first` on, with its sound. */
function encodeGathered(film: Film, first: number, picture: Picture): void {
  const { name, soundtrack } = film;
  writeSoundtrack(soundtrack, picture, soundtrackFile(name));
  encodeFilm(
    framesDir(name),
    first,
    picture,
    soundtrackFile(name),
    filmFile(name)
  );
  console.log(describeFilm(filmFile(name)));
}

/** Renders the frames asked for and encodes the film once all are there. */
async function renderFilm(
  film: Film,
  scene: FarmScene,
  range: string | undefined,
  frames: Frames
): Promise<void> {
  const { name } = film;
  mkdirSync(framesDir(name), { recursive: true });
  const [first, last] = range ? frameRange(range) : [scene.first, scene.last];
  const farmFrames = await frames({
    name,
    blend: scene.blend,
    first,
    last,
    fps: scene.fps,
  });
  for (let frame = first; frame <= last; frame++) {
    copyFileSync(
      join(farmFrames, frameName(frame)),
      join(framesDir(name), frameName(frame))
    );
  }
  const missing = missingFrames(name, scene.first, scene.last);
  if (missing.length) {
    console.log(
      `${framesDir(name)} lacks ${missing.length} frames (first ${missing[0]}): render them, then run again.`
    );
    return;
  }
  encodeGathered(film, scene.first, {
    frames: scene.last - scene.first + 1,
    fps: scene.fps,
  });
}

/**
 * `--encode`: the film again from the frames gathered earlier. Which frames
 * a film has is taken from its soundtrack, so Blender is not needed.
 */
function encodeAgain(film: Film): void {
  const { frames, fps } = film.soundtrack;
  const last = FIRST_FRAME + frames - 1;
  const missing = missingFrames(film.name, FIRST_FRAME, last);
  if (missing.length) {
    throw new Error(
      `${framesDir(film.name)} lacks ${missing.length} of the frames ` +
        `${FIRST_FRAME}-${last} (first ${missing[0]}): render them first`
    );
  }
  encodeGathered(film, FIRST_FRAME, { frames, fps });
}

/** `--dub`: the scene's sound onto the film that exists, its picture untouched. */
function dub(film: Film): void {
  const file = filmFile(film.name);
  if (!existsSync(file)) {
    throw new Error(`no film ${file} to lay the sound onto`);
  }
  writeSoundtrack(film.soundtrack, pictureOf(file), soundtrackFile(film.name));
  dubFilm(file, soundtrackFile(film.name));
  console.log(describeFilm(file));
}

/** Builds the scene, or takes the .blend named, and prepares it for the farm. */
function farmScene(
  values: { scene: string; blend?: string },
  name: string,
  still: boolean
): FarmScene {
  const blend = values.blend ? resolve(values.blend) : buildScene(values.scene);
  const suffix = still ? 'still-farm' : 'farm';
  return prepareForFarm(
    blend,
    join(workDir(name), `${name}-${suffix}.blend`),
    still
  );
}

function farmFrames({ collect }: { collect?: string }): Frames {
  return collect ? () => Promise.resolve(runFrames(collect)) : renderOnFarm;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      scene: { type: 'string', default: DEFAULT_SCENE },
      blend: { type: 'string' },
      frames: { type: 'string' },
      name: { type: 'string' },
      still: { type: 'boolean', default: false },
      collect: { type: 'string' },
      encode: { type: 'boolean', default: false },
      dub: { type: 'boolean', default: false },
    },
  });
  if ([values.still, values.encode, values.dub].filter(Boolean).length > 1) {
    throw new Error('--still, --encode and --dub exclude each other');
  }
  const source = values.blend ?? sceneScript(values.scene);
  const name = values.name ?? sceneName(source);
  mkdirSync(workDir(name), { recursive: true });
  mkdirSync(rendersDir, { recursive: true });
  if (values.still) {
    await renderStill(name, farmScene(values, name, true), farmFrames(values));
    return;
  }
  // Before anything is rendered: a scene without sound of its own is refused.
  const film: Film = { name, soundtrack: soundtrackOf(source) };
  if (values.encode) {
    encodeAgain(film);
  } else if (values.dub) {
    dub(film);
  } else {
    await renderFilm(
      film,
      farmScene(values, name, false),
      values.frames,
      farmFrames(values)
    );
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
