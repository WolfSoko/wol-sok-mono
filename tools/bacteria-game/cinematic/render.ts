/**
 * Renders a Blender scene of apps/bacteria-wars-cinematic on the Flamenco
 * render farm and cuts the frames into an MP4.
 *
 * The farm lives inside the tailnet: the Manager's API and its shared storage
 * are only reachable from a machine on it, so this runs there, never in CI.
 *
 * 1. Scene: builds the .blend from a scene script (`--scene`, default
 *    blender/scenes/bacteria_fight.py) or takes one (`--blend`), and writes
 *    the farm's render settings into a copy (blender/render/farm_settings.py).
 * 2. Farm: copies it to the Manager's shared storage and submits a
 *    simple-blender-render job, one frame per task, then waits for it.
 * 3. Video: gathers the frames into dist/bacteria-wars-cinematic/<name>/frames
 *    (frames of earlier runs stay, so `--frames 161-320` re-renders a part)
 *    and, once every frame of the scene is there, encodes
 *    apps/bacteria-wars-cinematic/renders/<name>.mp4 (H.264, CRF 18).
 *
 * Environment:
 * - FLAMENCO_MANAGER: the Manager's URL on the tailnet, e.g.
 *   https://<host>.<tailnet>.ts.net:8445
 * - FLAMENCO_STORAGE: the Manager's shared storage as this machine sees it
 *   (the `{storage}` variable of the farm), e.g. \\<host>\flamenco
 * - BLENDER: the Blender executable (default `blender` on the PATH)
 * - FFMPEG: see ../promo-video/ffmpeg.ts
 *
 * Run `npx nx run bacteria-wars-cinematic:render`, with `-- --frames 1-24`,
 * `--scene <script>`, `--blend <file>` or `--name <name>`.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { ffmpeg } from '../promo-video/ffmpeg';

const projectDir = resolve('apps/bacteria-wars-cinematic');
const storageFolder = 'bacteria-wars-cinematic';
const POLL_MS = 30_000;

interface Job {
  id: string;
  status: string;
  activity?: string;
}

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set (see tools/bacteria-game/cinematic/render.ts)`
    );
  }
  return value;
}

function blender(args: string[]): string {
  return execFileSync(process.env['BLENDER'] ?? 'blender', ['-b', ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

/** "161-320" -> [161, 320]. */
function frameRange(text: string): [number, number] {
  const match = /^(\d+)-(\d+)$/.exec(text);
  if (!match) {
    throw new Error(`--frames takes <first>-<last>, not ${text}`);
  }
  return [Number(match[1]), Number(match[2])];
}

function frameName(frame: number): string {
  return `frame_${String(frame).padStart(4, '0')}.png`;
}

/** Calls the Flamenco Manager's API; `body` is sent as JSON with a POST. */
async function manager<T>(path: string, body?: unknown): Promise<T> {
  const method = body === undefined ? 'GET' : 'POST';
  const response = await fetch(
    `${env('FLAMENCO_MANAGER').replace(/\/$/, '')}/api/v3${path}`,
    {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }
  );
  if (!response.ok) {
    throw new Error(
      `${method} ${path}: ${response.status} ${await response.text()}`
    );
  }
  return (await response.json()) as T;
}

async function waitFor(job: Job): Promise<void> {
  for (;;) {
    const now = await manager<Job>(`/jobs/${job.id}`);
    console.log(
      `${new Date().toLocaleTimeString()} ${now.status}${now.activity ? `: ${now.activity}` : ''}`
    );
    if (now.status === 'completed') {
      return;
    }
    if (['failed', 'canceled'].includes(now.status)) {
      throw new Error(
        `job ${job.id} ${now.status}; requeue it in the Manager's web interface`
      );
    }
    await new Promise((done) => setTimeout(done, POLL_MS));
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      scene: {
        type: 'string',
        default: join(projectDir, 'blender/scenes/bacteria_fight.py'),
      },
      blend: { type: 'string' },
      frames: { type: 'string' },
      name: { type: 'string' },
    },
  });
  const source = values.blend ?? values.scene;
  const name =
    values.name ??
    basename(source)
      .replace(/\.(blend|py)$/, '')
      .replaceAll('_', '-');
  const workDir = resolve('dist/bacteria-wars-cinematic', name);
  const framesDir = join(workDir, 'frames');
  mkdirSync(framesDir, { recursive: true });

  // 1. scene
  let blend = values.blend
    ? resolve(values.blend)
    : join(workDir, `${name}.blend`);
  if (!values.blend) {
    console.log(`Building ${blend} from ${values.scene}`);
    blender([
      '--factory-startup',
      '--python',
      resolve(values.scene),
      '--',
      blend,
    ]);
  }
  const farmBlend = join(workDir, `${name}-farm.blend`);
  const settings = blender([
    blend,
    '--python',
    join(projectDir, 'blender/render/farm_settings.py'),
    '--',
    farmBlend,
  ]);
  const info = /FRAMES (\d+) (\d+) FPS (\d+)/.exec(settings);
  if (!info) {
    throw new Error(`farm_settings.py printed no frame range:\n${settings}`);
  }
  const [sceneFirst, sceneLast, fps] = info.slice(1).map(Number);
  const [first, last] = values.frames
    ? frameRange(values.frames)
    : [sceneFirst, sceneLast];
  blend = farmBlend;

  // 2. farm
  const run = `${name}-${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}`;
  const runDir = join(env('FLAMENCO_STORAGE'), storageFolder, run);
  mkdirSync(join(runDir, 'frames'), { recursive: true });
  copyFileSync(blend, join(runDir, 'scene.blend'));
  const farmPath = `{storage}/${storageFolder}/${run}`;
  const job = await manager<Job>('/jobs', {
    name: `${name} ${first}-${last}`,
    type: 'simple-blender-render',
    priority: 50,
    submitter_platform: process.platform === 'win32' ? 'windows' : 'linux',
    settings: {
      frames: `${first}-${last}`,
      chunk_size: 1,
      blendfile: `${farmPath}/scene.blend`,
      render_output_root: `${farmPath}/frames/`,
      add_path_components: 0,
      render_output_path: `${farmPath}/frames/frame_####`,
      format: 'PNG',
      image_file_extension: '.png',
      fps,
      has_previews: false,
      scene: 'Scene',
    },
    metadata: { project: 'bacteria-wars-cinematic' },
  });
  console.log(`Job ${job.id}: frames ${first}-${last} of ${run}`);
  await waitFor(job);

  // 3. video
  for (let frame = first; frame <= last; frame++) {
    copyFileSync(
      join(runDir, 'frames', frameName(frame)),
      join(framesDir, frameName(frame))
    );
  }
  const missing = [];
  for (let frame = sceneFirst; frame <= sceneLast; frame++) {
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
  const out = join(projectDir, 'renders', `${name}.mp4`);
  mkdirSync(join(projectDir, 'renders'), { recursive: true });
  execFileSync(
    ffmpeg(),
    [
      '-y',
      '-loglevel',
      'error',
      '-framerate',
      String(fps),
      '-start_number',
      String(sceneFirst),
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
    ],
    { stdio: 'inherit' }
  );
  console.log(`${out}: ${readdirSync(framesDir).length} frames at ${fps} fps`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
