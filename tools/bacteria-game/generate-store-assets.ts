/**
 * Draws the Google Play graphics of the Bacteria Wars Android app from the
 * running game: the screenshots, the feature graphic and the store icon.
 *
 * Output: apps/bacteria-wars-android/store/graphics/ - `icon.png` (512 x 512,
 * the web app's icon), `feature-graphic.png` (1024 x 500) and
 * `screenshot-<n>.png` (1920 x 1080, a landscape phone with touch seats). The
 * deploy target uploads whatever differs from Play, so regenerate them when
 * the game looks different and commit the result.
 *
 * Needs the web app on http://localhost:4202 (`npx nx serve
 * bacteria-game-remote`), then run `npx nx run bacteria-wars-android:store-assets`.
 * The matches are live, so every run gives slightly different screenshots.
 */
import { Browser, chromium, Page } from '@playwright/test';
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const url = process.env['BACTERIA_GAME_URL'] ?? 'http://localhost:4202/';
const outDir = resolve('apps/bacteria-wars-android/store/graphics');
const iconsDir = resolve('apps/bacteria-game-remote/src/icons');

/** One screenshot: how to get there from a fresh start of the game. */
interface Shot {
  name: string;
  take(page: Page): Promise<void>;
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

async function play(
  page: Page,
  mode: string,
  level: string,
  seconds: number,
  steer = true
): Promise<void> {
  await newGame(page, mode, level);
  await page.getByRole('button', { name: /^Start / }).click();
  if (steer) {
    // Towards the middle, so the orange colony meets the other one.
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(seconds * 500);
    await page.keyboard.up('KeyD');
    await page.waitForTimeout(seconds * 500);
  } else {
    await page.waitForTimeout(seconds * 1000);
  }
}

const shots: Shot[] = [
  {
    name: 'screenshot-1',
    take: (page) => play(page, 'Free play', 'Heartbeat', 9),
  },
  {
    name: 'screenshot-2',
    take: (page) => play(page, 'Two players', 'Meltdown', 8),
  },
  {
    name: 'screenshot-3',
    take: (page) => play(page, 'Free play', 'Expanse', 10, false),
  },
  {
    name: 'screenshot-4',
    take: async (page) => {
      await page.getByRole('button', { name: /New game/ }).click();
      await page
        .locator('feat-lazy-bac-game-new-game .mode')
        .filter({ hasText: 'Free play' })
        .click();
      await page.waitForTimeout(1500);
    },
  },
  {
    name: 'screenshot-5',
    take: async (page) => {
      await newGame(page, 'Free play', 'Twin Chambers');
      await page.waitForTimeout(1500);
    },
  },
];

/** A fresh visit, as a phone lying across: touch seats, no saved progress. */
async function freshPage(
  browser: Browser,
  width: number,
  height: number,
  scale: number
): Promise<Page> {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: scale,
    hasTouch: true,
    isMobile: true,
  });
  return context.newPage();
}

async function screenshots(browser: Browser): Promise<void> {
  for (const shot of shots) {
    const page = await freshPage(browser, 960, 540, 2);
    await page.goto(url);
    await page.locator('feat-lazy-bac-game-main-menu h1').waitFor();
    await page.waitForTimeout(1500);
    await shot.take(page);
    await page.screenshot({ path: join(outDir, `${shot.name}.png`) });
    await page.context().close();
    console.log(`${shot.name}.png`);
  }
}

/** The title over a match, the dish of the app icon beside it. */
async function featureGraphic(browser: Browser): Promise<void> {
  const page = await freshPage(browser, 1024, 500, 1);
  const dataUrl = (path: string, type: string) =>
    `data:${type};base64,${readFileSync(path).toString('base64')}`;
  await page.setContent(`<!doctype html>
<html><head>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Bricolage+Grotesque:opsz,wght@12..96,800&display=block">
<style>
  html, body { margin: 0; width: 1024px; height: 500px; overflow: hidden; background: #0a0d12; }
  /* The arena of the first screenshot, without the bar and the seats. */
  .match { position: absolute; inset: 0; background: url(${dataUrl(join(outDir, 'screenshot-1.png'), 'image/png')}) -250px -230px / 1600px 900px; filter: saturate(1.2); }
  .shade { position: absolute; inset: 0; background: linear-gradient(90deg, #0a0d12 0%, #0a0d12ee 38%, #0a0d1280 70%, #0a0d1233 100%); }
  .content { position: absolute; inset: 0; display: flex; align-items: center; gap: 36px; padding: 0 56px; }
  img { width: 200px; height: 200px; border-radius: 50%; box-shadow: 0 0 60px #f5b94255; }
  h1 { margin: 0; font: 800 88px/0.95 'Bricolage Grotesque', sans-serif; color: #eef2f8; letter-spacing: -2px; }
  h1 span { color: #ff7a2f; }
  p { margin: 18px 0 0; font: 400 30px/1.25 'Atkinson Hyperlegible', sans-serif; color: #c9d3e1; }
</style></head>
<body>
  <div class="match"></div><div class="shade"></div>
  <div class="content">
    <img src="${dataUrl(join(iconsDir, 'icon.svg'), 'image/svg+xml')}" alt="">
    <div><h1>Bacteria<br><span>Wars</span></h1><p>Steer your colony.<br>Swallow the other one.</p></div>
  </div>
</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(outDir, 'feature-graphic.png') });
  await page.context().close();
  console.log('feature-graphic.png');
}

async function main(): Promise<void> {
  mkdirSync(outDir, { recursive: true });
  copyFileSync(join(iconsDir, 'icon-512.png'), join(outDir, 'icon.png'));
  console.log('icon.png');
  const browser = await chromium.launch({
    args: ['--enable-gpu', '--use-angle=vulkan', '--ignore-gpu-blocklist'],
  });
  try {
    await screenshots(browser);
    await featureGraphic(browser);
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
