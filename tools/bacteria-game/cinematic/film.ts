/**
 * Encodes the films of apps/bacteria-wars-cinematic, each with its sound:
 * a film from its frames, a film that exists with a soundtrack laid onto
 * it, and the reel cut from films. The picture is H.264 (CRF 18), the sound
 * the scene's synthesised soundtrack (sound/soundtracks.ts) as AAC,
 * loudness-normalised to -14 LUFS as the promo videos.
 *
 * Needs an ffmpeg with libx264 (see ../promo-video/ffmpeg.ts).
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { renameSync, writeFileSync } from 'node:fs';
import { ffmpeg } from '../promo-video/ffmpeg';
import { crossfades, reelLength } from './reel-cut';
import { Soundtrack } from './sound/soundtracks';

const PICTURE_CODEC = [
  '-c:v',
  'libx264',
  '-preset',
  'slow',
  '-crf',
  '18',
  '-pix_fmt',
  'yuv420p',
];
/**
 * loudnorm stamps the last stretch it lets go of (some three seconds before
 * the end) a moment late; the encoder then leaves a hole there and drops as
 * much at the end. asetpts counts the samples anew, so none is lost.
 */
const SOUND_CODEC = [
  '-af',
  'loudnorm=I=-14:TP=-1.5:LRA=11,asetpts=N/SR/TB',
  '-c:a',
  'aac',
  '-b:a',
  '192k',
  '-ar',
  '44100',
];
/** The index first in the file, so a player starts before all of it has loaded. */
const FAST_START = ['-movflags', '+faststart'];

/** A film's picture: how many frames, at how many a second. */
export interface Picture {
  frames: number;
  fps: number;
}

export function pictureSeconds({ frames, fps }: Picture): number {
  return frames / fps;
}

export function runFfmpeg(args: string[]): void {
  execFileSync(ffmpeg(), ['-y', '-loglevel', 'error', ...args], {
    stdio: 'inherit',
  });
}

/**
 * What ffmpeg reports when run with those arguments. It writes that to
 * stderr, and ends with an error when given an input but no output.
 */
function ffmpegReport(args: string[]): string {
  const run = spawnSync(ffmpeg(), ['-hide_banner', ...args], {
    encoding: 'utf8',
  });
  if (run.error) {
    throw run.error;
  }
  return run.stderr;
}

/**
 * The picture of a film file, counted from its video stream: the file's own
 * length would also count sound that runs a moment longer.
 */
export function pictureOf(film: string): Picture {
  // Copying the video stream to nowhere makes ffmpeg count its frames.
  const toNowhere = ['-map', '0:v:0', '-c', 'copy', '-f', 'null', '-'];
  const report = ffmpegReport(['-i', film, ...toNowhere]);
  const fps = /Video:.* (\d+(?:\.\d+)?) fps/.exec(report);
  const frames = [...report.matchAll(/frame=\s*(\d+)/g)].at(-1);
  if (!fps || !frames) {
    throw new Error(`ffmpeg reports no picture for ${film}`);
  }
  return { frames: Number(frames[1]), fps: Number(fps[1]) };
}

/**
 * Writes a scene's soundtrack as a WAV file, for a film of that picture. A
 * soundtrack written for another length or frame rate is refused: its
 * effects would miss what they belong to.
 */
export function writeSoundtrack(
  soundtrack: Soundtrack,
  picture: Picture,
  wav: string
): void {
  if (soundtrack.frames !== picture.frames || soundtrack.fps !== picture.fps) {
    throw new Error(
      `the soundtrack is written for ${soundtrack.frames} frames at ` +
        `${soundtrack.fps} fps, the film has ${picture.frames} at ` +
        `${picture.fps}: bring its cues in tools/bacteria-game/cinematic/sound ` +
        'in line with the scene script'
    );
  }
  writeFileSync(wav, soundtrack.wav());
}

/** Encodes the frames `frame_<number>.png` of a folder and a soundtrack into a film. */
export function encodeFilm(
  framesDir: string,
  firstFrame: number,
  picture: Picture,
  wav: string,
  out: string
): void {
  runFfmpeg([
    '-framerate',
    String(picture.fps),
    '-start_number',
    String(firstFrame),
    '-i',
    `${framesDir}/frame_%04d.png`,
    '-i',
    wav,
    ...PICTURE_CODEC,
    ...SOUND_CODEC,
    '-t',
    String(pictureSeconds(picture)),
    ...FAST_START,
    out,
  ]);
}

/**
 * Lays a soundtrack onto a film that exists, in place: the video stream is
 * copied as it is, sound the film had is replaced.
 */
export function dubFilm(film: string, wav: string): void {
  const dubbed = film.replace(/\.mp4$/, '.dubbed.mp4');
  runFfmpeg([
    '-i',
    film,
    '-i',
    wav,
    '-map',
    '0:v:0',
    '-map',
    '1:a:0',
    '-c:v',
    'copy',
    ...SOUND_CODEC,
    '-t',
    String(pictureSeconds(pictureOf(film))),
    ...FAST_START,
    dubbed,
  ]);
  renameSync(dubbed, film);
}

/**
 * Cuts films into a reel, each fading into the next over `fade` seconds,
 * under one soundtrack; the films' own sound is left out.
 */
export function cutReel(
  films: string[],
  lengths: number[],
  fade: number,
  wav: string,
  out: string
): void {
  runFfmpeg([
    ...films.flatMap((film) => ['-i', film]),
    '-i',
    wav,
    '-filter_complex',
    crossfades(lengths, fade),
    '-map',
    `[v${films.length - 1}]`,
    '-map',
    `${films.length}:a:0`,
    ...PICTURE_CODEC,
    ...SOUND_CODEC,
    '-t',
    String(reelLength(lengths, fade)),
    ...FAST_START,
    out,
  ]);
}

/** One line about a film file: its streams and length, as ffmpeg reports them. */
export function describeFilm(film: string): string {
  const report = ffmpegReport(['-i', film]);
  const length = /Duration: ([\d:.]+)/.exec(report)?.[1] ?? 'unknown length';
  const streams = [
    ...report.matchAll(/Stream #\d+:\d+.*?: (Video|Audio): (\w+)/g),
  ]
    .map((stream) => `${stream[1].toLowerCase()} ${stream[2]}`)
    .join(', ');
  return `${film}: ${length}, ${streams}`;
}
