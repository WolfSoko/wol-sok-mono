/**
 * The Flamenco render farm of apps/bacteria-wars-cinematic: puts a .blend on
 * the Manager's shared storage, submits a simple-blender-render job, a few
 * frames per task, and waits for it.
 *
 * The farm lives inside the tailnet: the Manager's API and its shared storage
 * are only reachable from a machine on it.
 *
 * Environment:
 * - FLAMENCO_MANAGER: the Manager's URL on the tailnet, e.g.
 *   https://<host>.<tailnet>.ts.net:8445
 * - FLAMENCO_STORAGE: the Manager's shared storage as this machine sees it
 *   (the `{storage}` variable of the farm), e.g. \\<host>\flamenco
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const STORAGE_FOLDER = 'bacteria-wars-cinematic';
const POLL_MS = 30_000;
/**
 * Frames a worker renders in one run of Blender. Starting Blender and loading
 * a scene takes a worker as long as rendering one of its frames, so one frame
 * per task doubled the time a film took; a failed task costs this many frames.
 */
const FRAMES_PER_TASK = 8;

interface Job {
  id: string;
  status: string;
  activity?: string;
}

export interface FarmRender {
  /** Names the job and its folder on the storage. */
  name: string;
  /** The .blend to render, with the farm's settings already in it. */
  blend: string;
  first: number;
  last: number;
  fps: number;
}

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set (see tools/bacteria-game/cinematic/farm.ts)`
    );
  }
  return value;
}

export function frameName(frame: number): string {
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

async function waitFor(job: Job, label: string): Promise<void> {
  for (;;) {
    const now = await manager<Job>(`/jobs/${job.id}`);
    console.log(
      `${new Date().toLocaleTimeString()} ${label} ${now.status}${now.activity ? `: ${now.activity}` : ''}`
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

/**
 * Renders the frames on the farm and returns the folder on the shared
 * storage that holds them, named by frameName().
 */
export async function renderOnFarm(render: FarmRender): Promise<string> {
  const { name, first, last } = render;
  const run = `${name}-${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}`;
  const runDir = join(env('FLAMENCO_STORAGE'), STORAGE_FOLDER, run);
  mkdirSync(join(runDir, 'frames'), { recursive: true });
  copyFileSync(render.blend, join(runDir, 'scene.blend'));
  const farmPath = `{storage}/${STORAGE_FOLDER}/${run}`;
  const job = await manager<Job>('/jobs', {
    name: `${name} ${first}-${last}`,
    type: 'simple-blender-render',
    priority: 50,
    submitter_platform: process.platform === 'win32' ? 'windows' : 'linux',
    settings: {
      frames: `${first}-${last}`,
      chunk_size: FRAMES_PER_TASK,
      blendfile: `${farmPath}/scene.blend`,
      render_output_root: `${farmPath}/frames/`,
      add_path_components: 0,
      render_output_path: `${farmPath}/frames/frame_####`,
      format: 'PNG',
      image_file_extension: '.png',
      fps: render.fps,
      has_previews: false,
      scene: 'Scene',
    },
    metadata: { project: 'bacteria-wars-cinematic' },
  });
  console.log(`Job ${job.id}: frames ${first}-${last} of ${run}`);
  await waitFor(job, name);
  return join(runDir, 'frames');
}
