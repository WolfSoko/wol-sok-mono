/**
 * Cuts the feature reel of apps/bacteria-wars-cinematic: the films of the
 * shots listed in its shots.json, in that order, each fading into the next,
 * as renders/bacteria-wars-reel.mp4 (silent, no text: an intro or the
 * footage for an ad, to be captioned per language).
 *
 * Every shot must have been rendered first (renders/<name>.mp4, see
 * render.ts). Needs an ffmpeg with libx264 (see ../promo-video/ffmpeg.ts).
 * Run `npx nx run bacteria-wars-cinematic:reel`.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ffmpeg } from '../promo-video/ffmpeg';
import { crossfades } from './reel-cut';
import { rendersDir, sceneName, shots } from './scenes';

/** How long one shot fades into the next, in seconds. */
const FADE = 0.5;
const REEL = 'bacteria-wars-reel.mp4';

/** A film's length in seconds, read from what ffmpeg reports about it. */
function duration(film: string): number {
  let report: string;
  try {
    report = execFileSync(ffmpeg(), ['-hide_banner', '-i', film], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    // ffmpeg ends with an error when given no output, after printing the report
    report = String((error as { stderr?: string }).stderr);
  }
  const match = /Duration: (\d+):(\d+):(\d+\.\d+)/.exec(report);
  if (!match) {
    throw new Error(`ffmpeg reports no duration for ${film}`);
  }
  const [hours, minutes, seconds] = match.slice(1).map(Number);
  return hours * 3600 + minutes * 60 + seconds;
}

const films = shots().reel.map((scene) =>
  join(rendersDir, `${sceneName(scene)}.mp4`)
);
const missing = films.filter((film) => !existsSync(film));
if (missing.length) {
  console.error(`Render these shots first:\n${missing.join('\n')}`);
  process.exit(1);
}
if (films.length < 2) {
  console.error('shots.json lists fewer than two shots: nothing to cut');
  process.exit(1);
}
const out = join(rendersDir, REEL);
execFileSync(
  ffmpeg(),
  [
    '-y',
    '-loglevel',
    'error',
    ...films.flatMap((film) => ['-i', film]),
    '-filter_complex',
    crossfades(films.map(duration), FADE),
    '-map',
    `[v${films.length - 1}]`,
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
console.log(`${out}: ${films.length} shots, ${duration(out).toFixed(1)} s`);
