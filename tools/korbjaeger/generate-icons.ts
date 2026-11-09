/**
 * Draws the Korbjäger app icon: a basketball in the theme's orange on its
 * darkest tone.
 *
 * Output: apps/korbjaeger/src/public/icons/icon.svg, the PNGs the web app
 * manifest and iOS ask for, and apps/korbjaeger/src/public/favicon.ico. The
 * background bleeds to the edges and the ball stays inside the central
 * 80 % safe zone, so the same picture works as a maskable icon. A run
 * without changes reproduces the files.
 *
 * Run with `npx nx run korbjaeger:icons`.
 */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { render, svgPage, toIco } from '../icons/render-icons';

const publicDir = resolve('apps/korbjaeger/src/public');
const iconsDir = join(publicDir, 'icons');

/**
 * The app's theme (`mat.$orange-palette` in `styles.scss`): tone 60 for the
 * ball, as the manifest's and the page's `theme-color`, tone 10 behind it
 * and for the seams.
 */
const ORANGE = '#e37100';
const DUNKEL = '#311300';

const C = 256;
/** Inside the maskable safe zone's radius of 0.4 × 512 = 204.8. */
const BALL_R = 180;
const NAHT = 14;

/** Where a seam meets the ball's rim at 45°. */
const RAND_45 = BALL_R * Math.SQRT1_2;

function iconSvg(): string {
  const links = C - RAND_45;
  const rechts = C + RAND_45;
  const oben = C - RAND_45;
  const unten = C + RAND_45;
  // the curved seams bow towards the middle, as on a ball seen from the side
  const bogen = 92;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${DUNKEL}"/>
  <defs><clipPath id="ball"><circle cx="${C}" cy="${C}" r="${BALL_R}"/></clipPath></defs>
  <circle cx="${C}" cy="${C}" r="${BALL_R}" fill="${ORANGE}"/>
  <g fill="none" stroke="${DUNKEL}" stroke-width="${NAHT}" stroke-linecap="round" clip-path="url(#ball)">
    <path d="M${C} ${C - BALL_R} V${C + BALL_R}"/>
    <path d="M${C - BALL_R} ${C} H${C + BALL_R}"/>
    <path d="M${f(links)} ${f(oben)} Q${f(links + bogen * 2)} ${C} ${f(links)} ${f(unten)}"/>
    <path d="M${f(rechts)} ${f(oben)} Q${f(rechts - bogen * 2)} ${C} ${f(rechts)} ${f(unten)}"/>
  </g>
</svg>
`;
}

/** A coordinate with one decimal, so the SVG reads the same on every run. */
function f(value: number): string {
  return value.toFixed(1);
}

/** Manifest icons (any and maskable share one picture) and the iOS icon. */
const PNG_ICONS: ReadonlyArray<{ file: string; size: number }> = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
];
const FAVICON_SIZES = [16, 32, 48];

async function main(): Promise<void> {
  const svg = iconSvg();
  await mkdir(iconsDir, { recursive: true });
  await writeFile(join(iconsDir, 'icon.svg'), svg);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (const { file, size } of PNG_ICONS) {
      await writeFile(
        join(iconsDir, file),
        await render(page, svgPage(svg, size), size, size, false)
      );
    }
    const favicons = [];
    for (const size of FAVICON_SIZES) {
      favicons.push({
        size,
        png: await render(page, svgPage(svg, size), size, size, false),
      });
    }
    await writeFile(join(publicDir, 'favicon.ico'), toIco(favicons));
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
