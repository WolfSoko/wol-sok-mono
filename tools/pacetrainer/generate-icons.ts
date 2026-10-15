/**
 * Renders the Pace-Trainer icons from the master logo.
 *
 * Source: apps/pacetrainer/src/public/logo.svg
 * Output (same folder): favicon PNGs + favicon.ico, apple-touch-icon,
 * android-chrome icons, the maskable icon and the Open Graph preview image.
 *
 * Run with `npx nx run pacetrainer:icons`.
 */
import { chromium, Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const publicDir = resolve('apps/pacetrainer/src/public');

/**
 * Icons with `fullBleed` are square: iOS and maskable Android launchers put
 * their own mask over the image, so the tile fills the corners instead of
 * leaving them transparent (which iOS fills with black).
 * Icons with `ico` are also packed into favicon.ico.
 */
const PNG_ICONS: Array<{
  file: string;
  size: number;
  fullBleed?: boolean;
  ico?: boolean;
}> = [
  { file: 'favicon-16x16.png', size: 16, ico: true },
  { file: 'favicon-32x32.png', size: 32, ico: true },
  { file: 'android-chrome-192x192.png', size: 192 },
  { file: 'android-chrome-512x512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180, fullBleed: true },
  { file: 'maskable-icon-512x512.png', size: 512, fullBleed: true },
];

/** Packs PNG images into one .ico container (PNG-in-ICO, every browser reads it). */
function toIco(images: Array<{ size: number; png: Buffer }>): Buffer {
  const headerSize = 6;
  const entrySize = 16;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  let offset = headerSize + entrySize * images.length;
  const entries = images.map(({ size, png }) => {
    const entry = Buffer.alloc(entrySize);
    entry.writeUInt8(size, 0);
    entry.writeUInt8(size, 1);
    entry.writeUInt8(0, 2); // palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map(({ png }) => png)]);
}

function toDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function iconPage(logo: string, size: number): string {
  return `<!doctype html>
<html><head><style>
  html, body { margin: 0; width: ${size}px; height: ${size}px; }
  img { display: block; width: ${size}px; height: ${size}px; }
</style></head>
<body><img src="${logo}" alt=""></body></html>`;
}

function ogPage(logo: string): string {
  return `<!doctype html>
<html lang="de"><head>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;700;800&display=swap" rel="stylesheet">
<style>
  html, body { margin: 0; }
  body {
    width: 1200px; height: 630px; display: flex; align-items: center;
    justify-content: center; gap: 64px;
    background: radial-gradient(ellipse 70% 80% at 30% 20%, #1c3a73 0%, #0a1530 70%);
    color: #fff; font-family: Inter, sans-serif;
  }
  img { width: 300px; height: 300px; filter: drop-shadow(0 24px 48px rgba(0,0,0,.45)); }
  h1 { margin: 0; font-size: 96px; font-weight: 800; letter-spacing: -0.03em; line-height: 1; }
  p { margin: 16px 0 0; font-size: 40px; font-weight: 500; color: #b9cdf7; letter-spacing: -0.01em; }
</style></head>
<body>
  <img src="${logo}" alt="">
  <div><h1>Pace-Trainer</h1><p>Dein digitaler Laufcoach.</p></div>
</body></html>`;
}

async function render(
  page: Page,
  html: string,
  width: number,
  height: number,
  omitBackground: boolean
): Promise<Buffer> {
  await page.setViewportSize({ width, height });
  await page.setContent(html);
  return page.screenshot({ omitBackground, type: 'png' });
}

async function main(): Promise<void> {
  const svg = await readFile(join(publicDir, 'logo.svg'), 'utf8');
  const logo = toDataUrl(svg);
  // the same logo with square corners: the tile's rounded rects lose their rx
  const squareLogo = toDataUrl(svg.replaceAll('rx="112"', 'rx="0"'));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const icoImages: Array<{ size: number; png: Buffer }> = [];

    for (const { file, size, fullBleed = false, ico = false } of PNG_ICONS) {
      const png = await render(
        page,
        iconPage(fullBleed ? squareLogo : logo, size),
        size,
        size,
        !fullBleed
      );
      await writeFile(join(publicDir, file), png);
      if (ico) {
        icoImages.push({ size, png });
      }
      console.log(`wrote ${file}`);
    }

    await writeFile(join(publicDir, 'favicon.ico'), toIco(icoImages));
    console.log('wrote favicon.ico');

    await page.setViewportSize({ width: 1200, height: 630 });
    await page.setContent(ogPage(logo));
    await page.evaluate(() => document.fonts.ready);
    // fonts.check() is true when no face matched at all, so inspect the faces
    const interLoaded = await page.evaluate(() =>
      [...document.fonts].some(
        (face) => face.family.includes('Inter') && face.status === 'loaded'
      )
    );
    if (!interLoaded) {
      throw new Error(
        'Inter did not load from Google Fonts; the OG image needs it (network?)'
      );
    }
    await writeFile(
      join(publicDir, 'og-image.png'),
      await page.screenshot({ type: 'png' })
    );
    console.log('wrote og-image.png');
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
