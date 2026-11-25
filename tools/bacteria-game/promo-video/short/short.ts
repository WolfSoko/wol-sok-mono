/**
 * Makes the Bacteria Wars Short, in English and German, from the Blender
 * animation of #3248 (`source.mp4`: three rod bacteria burst a coccus in a
 * blood vessel, 1080 x 1920, 24 fps, silent).
 *
 * 1. Cards: Playwright screenshots the text cards of cards.html (title,
 *    tagline, end card) with the texts of copy.json as transparent PNGs.
 * 2. Soundtrack: short-audio.ts synthesises it along timeline.ts.
 * 3. Cut: ffmpeg takes only the source's middle shot (1080 x 810 at y 554),
 *    rebuilds the blurred background above and below it from that shot, so
 *    none of the source's own text is left, fades the cards in over it and
 *    adds the soundtrack, loudness-normalised to -14 LUFS.
 *
 * Output: apps/bacteria-wars-android/store/promo-video/
 * bacteria-wars-short-<lang>-portrait.mp4; the cards and the soundtrack go
 * to dist/bacteria-wars-short/. Commit the videos: the deploy uploads them
 * to YouTube and links them from the Play listings (videos.json there).
 *
 * Needs an ffmpeg with libx264 (see ffmpeg.ts). Run
 * `npx nx run bacteria-wars-android:promo-short`, or with `--langs=de`.
 */
import { chromium, Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ffmpeg } from '../ffmpeg';
import { shortSoundtrack } from './short-audio';
import { SHORT_TIMELINE } from './timeline';

const sourceDir = resolve('tools/bacteria-game/promo-video/short');
const outDir = resolve('dist/bacteria-wars-short');
const videosDir = resolve('apps/bacteria-wars-android/store/promo-video');

/** Where the Blender shot sits in the source frame. */
const SHOT = { width: 1080, height: 810, top: 554 };
const FRAME = { width: 1080, height: 1920 };
/** How long each card takes to fade in, in seconds. */
const FADE = 0.6;

type Copy = Record<string, string>;
/** The cards of cards.html and when each fades in. */
const CARDS = [
  { id: 'title', at: SHORT_TIMELINE.titleIn },
  { id: 'tagline', at: SHORT_TIMELINE.taglineIn },
  { id: 'end', at: SHORT_TIMELINE.endCardIn },
] as const;

async function renderCards(page: Page, lang: string, copy: Copy) {
  const files: string[] = [];
  for (const { id } of CARDS) {
    await page.evaluate(
      ([cardId, texts]) =>
        (
          window as unknown as {
            showCard(id: string, copy: Copy): Promise<void>;
          }
        ).showCard(cardId, texts),
      [id, copy] as const
    );
    const file = join(outDir, `${lang}-${id}.png`);
    await page.screenshot({ path: file, omitBackground: true });
    files.push(file);
  }
  return files;
}

/** The ffmpeg filter graph: background, shot, then each card faded in. */
function filterGraph(): string {
  const { width, height, top } = SHOT;
  const steps = [
    `[0:v]crop=${width}:${height}:0:${top},split[shot][wide]`,
    // The blurred background: the shot scaled to cover the frame, darkened.
    `[wide]scale=-2:${FRAME.height},crop=${FRAME.width}:${FRAME.height},` +
      `gblur=sigma=40,eq=brightness=-0.12:saturation=1.1[bg]`,
    `[bg][shot]overlay=0:${top}[v0]`,
  ];
  CARDS.forEach(({ at }, k) => {
    steps.push(
      `[${k + 1}:v]format=rgba,fade=in:st=${at}:d=${FADE}:alpha=1[c${k}]`,
      `[v${k}][c${k}]overlay=0:0[v${k + 1}]`
    );
  });
  steps.push(`[v${CARDS.length}]setsar=1,format=yuv420p[out]`);
  return steps.join(';');
}

function cut(ffmpegExe: string, cards: string[], audio: string, video: string) {
  const duration = SHORT_TIMELINE.duration.toFixed(3);
  execFileSync(
    ffmpegExe,
    [
      '-y',
      '-loglevel',
      'error',
      '-i',
      join(sourceDir, 'source.mp4'),
      ...cards.flatMap((card) => [
        '-loop',
        '1',
        '-framerate',
        '24',
        '-t',
        duration,
        '-i',
        card,
      ]),
      '-i',
      audio,
      '-filter_complex',
      filterGraph(),
      '-map',
      '[out]',
      '-map',
      `${cards.length + 1}:a`,
      '-af',
      'loudnorm=I=-14:TP=-1.5:LRA=11',
      '-c:v',
      'libx264',
      '-preset',
      'slow',
      '-crf',
      '18',
      '-r',
      '24',
      '-movflags',
      '+faststart',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-ar',
      '44100',
      '-t',
      duration,
      video,
    ],
    { stdio: 'inherit' }
  );
}

async function main(): Promise<void> {
  const copies = JSON.parse(
    readFileSync(join(sourceDir, 'copy.json'), 'utf8')
  ) as Record<string, Copy>;
  const langs =
    process.argv
      .find((arg) => arg.startsWith('--langs='))
      ?.split('=')[1]
      .split(',') ?? Object.keys(copies);
  const ffmpegExe = ffmpeg();
  mkdirSync(outDir, { recursive: true });
  const audio = join(outDir, 'soundtrack.wav');
  writeFileSync(audio, shortSoundtrack());

  // The cards load the game's faces from node_modules.
  const browser = await chromium.launch({
    args: ['--allow-file-access-from-files'],
  });
  try {
    const page = await browser.newPage({ viewport: FRAME });
    await page.goto(pathToFileURL(join(sourceDir, 'cards.html')).href);
    for (const lang of langs) {
      const cards = await renderCards(page, lang, copies[lang]);
      const video = join(videosDir, `bacteria-wars-short-${lang}-portrait.mp4`);
      cut(ffmpegExe, cards, audio, video);
      console.log(video);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
