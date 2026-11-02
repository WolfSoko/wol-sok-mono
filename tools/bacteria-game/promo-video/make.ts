/**
 * Makes the 30-second promo video of Bacteria Wars from the running game.
 *
 * 1. Capture: Playwright plays four clips on the web app - Heartbeat against
 *    the computer, Meltdown for two, Expanse with its minimap, the level
 *    choice - as a phone lying across (1280 x 720, touch seats), recorded
 *    frame by frame with Chrome's screencast and its timestamps.
 * 2. Render: scenes.html lays the title, the clips in a phone and the
 *    captions of copy.json over each other along timeline.json, as a pure
 *    function of the time, so every frame is rendered on its own.
 * 3. Mux: ffmpeg joins the frames and the soundtrack of audio.ts into an
 *    H.264 MP4, loudness-normalised to -14 LUFS.
 *
 * Output: apps/bacteria-wars-android/store/promo-video/
 * bacteria-wars-promo-<lang>-<format>.mp4, for each version (`en:landscape`,
 * `de:landscape`, `en:portrait`); the clips and frames go to
 * dist/bacteria-wars-promo/. Commit the videos: the deploy uploads each new
 * one to YouTube and links it from the Play listing (videos.json there).
 *
 * Needs the web app on http://localhost:4202 (`npx nx serve
 * bacteria-game-remote`) and an ffmpeg with libx264: FFMPEG, or `ffmpeg` on
 * the PATH, or `uvx --from imageio-ffmpeg` fetches one. Then
 * `npx nx run bacteria-wars-android:promo-video`, with `--skip-capture` to
 * render again from the clips of the last run, or `--versions=en:portrait`.
 */
import { Browser, chromium, Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { soundtrack } from './audio';

const url = process.env['BACTERIA_GAME_URL'] ?? 'http://localhost:4202/';
const sourceDir = resolve('tools/bacteria-game/promo-video');
const outDir = resolve('dist/bacteria-wars-promo');
const clipsDir = join(outDir, 'clips');
/** The videos are committed: the deploy uploads them to YouTube. */
const videosDir = resolve('apps/bacteria-wars-android/store/promo-video');
const icon = resolve('apps/bacteria-game-remote/src/icons/icon.svg');

interface Scene {
  kind: 'title' | 'clip' | 'end';
  start: number;
  end: number;
  clip?: string;
}
interface Timeline {
  fps: number;
  duration: number;
  scenes: Scene[];
}

/** A clip: how long, how to get to its first frame, what to play. */
interface Clip {
  seconds: number;
  setup(page: Page): Promise<void>;
  play(page: Page): Promise<void>;
}

async function newGame(page: Page, mode: string, level: string): Promise<void> {
  await page.getByRole('button', { name: /New game/ }).click();
  await page
    .locator('feat-lazy-bac-game-new-game .mode')
    .filter({ hasText: mode })
    .click();
  await page
    .locator('.levels')
    .getByRole('button', { name: new RegExp(`^\\d+ ${level}\\b`) })
    .click();
}

/** A match started before the recording, so the clip opens on the arena. */
function match(mode: string, level: string) {
  return async (page: Page) => {
    await newGame(page, mode, level);
    await page.getByRole('button', { name: /^Start / }).click();
    await page.waitForTimeout(250);
  };
}

async function hold(page: Page, key: string, ms: number): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

const clips: Record<string, Clip> = {
  heartbeat: {
    seconds: 9,
    setup: match('Free play', 'Heartbeat'),
    play: async (page) => {
      await hold(page, 'KeyD', 2500);
      await hold(page, 'KeyS', 700);
      await hold(page, 'KeyD', 1500);
      await page.keyboard.press('Space');
      await hold(page, 'KeyD', 1500);
      await hold(page, 'KeyW', 800);
    },
  },
  meltdown: {
    seconds: 7,
    setup: match('Two players', 'Meltdown'),
    play: async (page) => {
      await Promise.all([
        hold(page, 'KeyD', 4000),
        hold(page, 'ArrowLeft', 3500),
      ]);
      await page.keyboard.press('Space');
      await page.keyboard.press('Enter');
    },
  },
  expanse: {
    seconds: 7,
    setup: match('Free play', 'Expanse'),
    play: async (page) => {
      await hold(page, 'KeyD', 3000);
      await hold(page, 'KeyS', 1500);
      await hold(page, 'KeyA', 1500);
    },
  },
  levels: {
    seconds: 5,
    setup: async () => undefined,
    play: async (page) => {
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: /New game/ }).click();
      await page.waitForTimeout(700);
      await page
        .locator('feat-lazy-bac-game-new-game .mode')
        .filter({ hasText: 'Free play' })
        .click();
      await page.waitForTimeout(1200);
      await page.mouse.move(640, 500);
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(900);
      await page.mouse.wheel(0, 600);
    },
  },
};

/**
 * Records a clip as JPEG frames and their times. The screencast takes the
 * window's pixels, so the window is as big as the viewport.
 */
async function record(
  browser: Browser,
  name: string,
  clip: Clip
): Promise<void> {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto(url);
  await page.locator('feat-lazy-bac-game-main-menu h1').waitFor();
  await page.waitForTimeout(1200);
  await clip.setup(page);

  const dir = join(clipsDir, name);
  mkdirSync(dir, { recursive: true });
  const times: number[] = [];
  const cdp = await context.newCDPSession(page);
  cdp.on('Page.screencastFrame', (frame) => {
    times.push(frame.metadata.timestamp ?? 0);
    writeFileSync(
      join(dir, `${String(times.length).padStart(5, '0')}.jpg`),
      Buffer.from(frame.data, 'base64')
    );
    void cdp
      .send('Page.screencastFrameAck', { sessionId: frame.sessionId })
      .catch(() => undefined);
  });
  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 92,
    maxWidth: 1280,
    maxHeight: 720,
  });
  const playing = clip.play(page);
  await page.waitForTimeout(clip.seconds * 1000);
  await cdp.send('Page.stopScreencast');
  await playing.catch(() => undefined);
  writeFileSync(join(dir, 'times.json'), JSON.stringify(times));
  console.log(`${name}: ${times.length} frames`);
  await context.close();
}

/** Every frame of one version, as JPEGs in dist/.../frames-<lang>-<format>. */
async function render(
  browser: Browser,
  timeline: Timeline,
  lang: string,
  format: string
): Promise<string> {
  const copy = readJson<Record<string, Record<string, string>>>(
    join(sourceDir, 'copy.json')
  )[lang];
  const clipData = Object.fromEntries(
    Object.keys(clips).map((name) => [
      name,
      {
        times: readJson<number[]>(join(clipsDir, name, 'times.json')),
        dir: pathToFileURL(join(clipsDir, name)).href,
      },
    ])
  );
  const iconUrl = `data:image/svg+xml;base64,${readFileSync(icon).toString('base64')}`;
  const [width, height] = format === 'portrait' ? [1080, 1920] : [1920, 1080];
  const page = await browser.newPage({ viewport: { width, height } });
  await page.addInitScript(
    ([copy, clips, timeline, icon]) =>
      Object.assign(window, {
        __copy: copy,
        __clips: clips,
        __timeline: timeline,
        __icon: icon,
      }),
    [copy, clipData, timeline, iconUrl] as const
  );
  await page.goto(
    `${pathToFileURL(join(sourceDir, 'scenes.html')).href}?format=${format}`
  );
  await page.evaluate(() => document.fonts.ready);

  const framesDir = join(outDir, `frames-${lang}-${format}`);
  rmSync(framesDir, { recursive: true, force: true });
  mkdirSync(framesDir, { recursive: true });
  const frames = Math.round((timeline.duration / 1000) * timeline.fps);
  for (let i = 0; i < frames; i++) {
    await page.evaluate(
      (t) =>
        (window as unknown as { __seek(t: number): Promise<void> }).__seek(t),
      (i * 1000) / timeline.fps
    );
    await page.screenshot({
      path: join(framesDir, `${String(i).padStart(5, '0')}.jpg`),
      type: 'jpeg',
      quality: 93,
    });
  }
  await page.close();
  return framesDir;
}

/** An ffmpeg with libx264: FFMPEG, the PATH, or one fetched by uvx. */
function ffmpeg(): string {
  if (process.env['FFMPEG']) {
    return process.env['FFMPEG'];
  }
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return 'ffmpeg';
  } catch {
    return execFileSync(
      'uvx',
      [
        '--from',
        'imageio-ffmpeg',
        'python',
        '-I',
        '-c',
        'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())',
      ],
      { encoding: 'utf8' }
    ).trim();
  }
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const skipCapture = args.includes('--skip-capture');
  const versions = (
    args.find((arg) => arg.startsWith('--versions='))?.split('=')[1] ??
    'en:landscape,de:landscape,en:portrait'
  )
    .split(',')
    .map((version) => version.split(':'));
  const timeline = readJson<Timeline>(join(sourceDir, 'timeline.json'));
  const ffmpegExe = ffmpeg();
  mkdirSync(outDir, { recursive: true });

  if (!skipCapture) {
    rmSync(clipsDir, { recursive: true, force: true });
    const browser = await chromium.launch({
      args: [
        '--enable-gpu',
        '--use-angle=vulkan',
        '--ignore-gpu-blocklist',
        '--window-size=1280,720',
      ],
    });
    try {
      for (const [name, clip] of Object.entries(clips)) {
        await record(browser, name, clip);
      }
    } finally {
      await browser.close();
    }
  }

  const clipScenes = timeline.scenes.filter((scene) => scene.kind === 'clip');
  const audio = join(outDir, 'soundtrack.wav');
  writeFileSync(
    audio,
    soundtrack(
      timeline.duration,
      timeline.scenes.slice(1).map((scene) => scene.start),
      [clipScenes[0].start, clipScenes[clipScenes.length - 1].end]
    )
  );

  // The scenes load the clip frames from the disk.
  const browser = await chromium.launch({
    args: ['--allow-file-access-from-files'],
  });
  try {
    for (const [lang, format] of versions) {
      const framesDir = await render(browser, timeline, lang, format);
      const video = join(
        videosDir,
        `bacteria-wars-promo-${lang}-${format}.mp4`
      );
      execFileSync(
        ffmpegExe,
        [
          '-y',
          '-loglevel',
          'error',
          '-framerate',
          String(timeline.fps),
          '-i',
          join(framesDir, '%05d.jpg'),
          '-i',
          audio,
          '-af',
          'loudnorm=I=-14:TP=-1.5:LRA=11',
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
          '-c:a',
          'aac',
          '-b:a',
          '192k',
          '-ar',
          '44100',
          '-shortest',
          video,
        ],
        { stdio: 'inherit' }
      );
      rmSync(framesDir, { recursive: true, force: true });
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
