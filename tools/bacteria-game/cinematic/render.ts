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
 *    (H.264, CRF 18).
 *
 * A still (`--still`): the scene's poster frame alone, at 3840 x 2160 with
 * twice the samples, kept lossless in dist/bacteria-wars-cinematic/<name>/still
 * and as renders/<name>.jpg.
 *
 * Environment: FLAMENCO_MANAGER and FLAMENCO_STORAGE (farm.ts), BLENDER
 * (scenes.ts), FFMPEG (../promo-video/ffmpeg.ts).
 *
 * Run `npx nx run bacteria-wars-cinematic:render`, with `-- --scene
 * dish_duel`, `--frames 1-24`, `--blend <file>`, `--name <name>` or `--still`.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { ffmpeg } from '../promo-video/ffmpeg';
import { frameName, renderOnFarm } from './farm';
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

function runFfmpeg(args: string[]): void {
  execFileSync(ffmpeg(), ['-y', '-loglevel', 'error', ...args], {
    stdio: 'inherit',
  });
}

/** Renders the poster frame large and keeps it as PNG (dist) and JPEG (renders). */
async function renderStill(name: string, scene: FarmScene): Promise<void> {
  const stillDir = join(workDir(name), 'still');
  mkdirSync(stillDir, { recursive: true });
  const farmFrames = await renderOnFarm({
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

/** Renders the frames asked for and encodes the film once all are there. */
async function renderFilm(
  name: string,
  scene: FarmScene,
  frames: string | undefined
): Promise<void> {
  const framesDir = join(workDir(name), 'frames');
  mkdirSync(framesDir, { recursive: true });
  const [first, last] = frames ? frameRange(frames) : [scene.first, scene.last];
  const farmFrames = await renderOnFarm({
    name,
    blend: scene.blend,
    first,
    last,
    fps: scene.fps,
  });
  for (let frame = first; frame <= last; frame++) {
    copyFileSync(
      join(farmFrames, frameName(frame)),
      join(framesDir, frameName(frame))
    );
  }
  const missing = [];
  for (let frame = scene.first; frame <= scene.last; frame++) {
    if (!existsSync(join(framesDir, frameName(frame)))) {
      missing.push(frame);
    }
  }
  if (missing.length) {
    console.log(
      `${framesDir} lacks ${missing.length} frames (first ${missing[0]}): render them, then run again.`
    );
    return;
  }
  const out = join(rendersDir, `${name}.mp4`);
  runFfmpeg([
    '-framerate',
    String(scene.fps),
    '-start_number',
    String(scene.first),
    '-i',
    join(framesDir, 'frame_%04d.png'),
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '18',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    out,
  ]);
  console.log(
    `${out}: ${readdirSync(framesDir).length} frames at ${scene.fps} fps`
  );
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      scene: { type: 'string', default: DEFAULT_SCENE },
      blend: { type: 'string' },
      frames: { type: 'string' },
      name: { type: 'string' },
      still: { type: 'boolean', default: false },
    },
  });
  const source = values.blend ?? sceneScript(values.scene);
  const name = values.name ?? sceneName(source);
  const blend = values.blend ? resolve(values.blend) : buildScene(values.scene);
  mkdirSync(workDir(name), { recursive: true });
  mkdirSync(rendersDir, { recursive: true });
  const suffix = values.still ? 'still-farm' : 'farm';
  const scene = prepareForFarm(
    blend,
    join(workDir(name), `${name}-${suffix}.blend`),
    values.still
  );
  await (values.still
    ? renderStill(name, scene)
    : renderFilm(name, scene, values.frames));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
