/**
 * Draws the Play Games Services icon of every achievement of Bacteria Wars:
 * a petri dish in the colours of the app icon with a symbol for the
 * achievement on it, on a transparent background.
 *
 * Output: apps/bacteria-wars-android/store/play-games/achievements/<id>.png,
 * 512 x 512, one per achievement of the game (see play-games.ts). The
 * Publishing API takes no icons any more, so they go up by hand in Play
 * Console; keep the files committed, so a changed icon shows in the diff.
 *
 * Run with `npx nx run bacteria-wars-android:achievement-icons`.
 */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { render } from '../icons/render-icons';
import { playGamesAchievements } from './play-games';

const outDir = resolve(
  'apps/bacteria-wars-android/store/play-games/achievements'
);
const SIZE = 512;

const ORANGE = '#ff8a2a';
const ORANGE_DEEP = '#e25400';
const CREAM = '#ffe9c4';
const BLUE = '#5aa9ff';
const SILVER = '#dfe7f1';

/**
 * The symbol of each achievement, as SVG drawn in a 512 x 512 box around
 * the centre of the dish. A stroke of `STROKE` in the given colour, no
 * fill, unless the glyph says otherwise.
 */
const STROKE = 26;
const GLYPHS: Record<string, string> = {
  // A drop of the first colony that spilled.
  'first-blood': `<path d="M256 118c-50 76-94 126-94 190a94 94 0 0 0 188 0c0-64-44-114-94-190z" fill="${ORANGE}"/>
    <ellipse cx="226" cy="300" rx="22" ry="34" fill="${CREAM}" opacity="0.5" transform="rotate(-20 226 300)"/>`,
  // The boost button, never pressed: a ring with a bar across.
  pacifist: `<circle cx="256" cy="256" r="118" stroke="${ORANGE}" stroke-width="${STROKE}" fill="none"/>
    <path d="M256 138v236M256 256l-84 84M256 256l84 84" stroke="${ORANGE}" stroke-width="${STROKE}" stroke-linecap="round" fill="none"/>`,
  blitz: `<path d="M292 112L172 284h74l-30 116 124-172h-76l28-116z" fill="${ORANGE}" stroke="${ORANGE_DEEP}" stroke-width="10" stroke-linejoin="round"/>`,
  // Down and back up: a line that dips, then climbs with an arrowhead.
  comeback: `<path d="M136 190c40 0 60 130 110 130s62-60 102-110" stroke="${ORANGE}" stroke-width="${STROKE}" stroke-linecap="round" fill="none"/>
    <path d="M300 160h60v60" stroke="${ORANGE}" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
  // An hourglass, the sand half way through.
  siege: `<path d="M172 134h168M172 378h168M190 134l66 122 66-122M190 378l66-122 66 122" stroke="${ORANGE}" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M226 170h60l-30 56z" fill="${CREAM}"/>
    <path d="M206 360h100l-50-70z" fill="${CREAM}"/>`,
  // A shield with a tick: nothing lost.
  'clean-sweep': `<path d="M256 124l106 40v86c0 70-44 118-106 146-62-28-106-76-106-146v-86z" stroke="${ORANGE}" stroke-width="${STROKE}" stroke-linejoin="round" fill="none"/>
    <path d="M206 262l34 34 70-74" stroke="${CREAM}" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
  // A dish filled to its rim.
  'full-dish': `<circle cx="256" cy="256" r="130" stroke="${CREAM}" stroke-width="16" fill="none"/>
    <circle cx="256" cy="256" r="104" fill="${ORANGE}"/>
    <circle cx="214" cy="214" r="28" fill="${CREAM}" opacity="0.45"/>`,
  // A gate: two posts and the bar between them, held shut.
  gatekeeper: `<path d="M160 150v212M352 150v212" stroke="${ORANGE}" stroke-width="40" stroke-linecap="round" fill="none"/>
    <path d="M160 206h192M160 306h192" stroke="${ORANGE}" stroke-width="${STROKE}" stroke-linecap="round" fill="none"/>
    <circle cx="256" cy="256" r="30" fill="${CREAM}"/>`,
  // Two arrows chasing each other: the other colony's cells turned.
  converter: `<path d="M330 186a104 104 0 0 0-166 20" stroke="${BLUE}" stroke-width="${STROKE}" stroke-linecap="round" fill="none"/>
    <path d="M152 160v60h60" stroke="${BLUE}" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M182 326a104 104 0 0 0 166-20" stroke="${ORANGE}" stroke-width="${STROKE}" stroke-linecap="round" fill="none"/>
    <path d="M360 352v-60h-60" stroke="${ORANGE}" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
  // A heap of pellets.
  glutton: `<circle cx="196" cy="300" r="40" fill="${CREAM}"/>
    <circle cx="316" cy="300" r="40" fill="${CREAM}"/>
    <circle cx="256" cy="212" r="40" fill="${CREAM}"/>
    <circle cx="256" cy="312" r="44" fill="${ORANGE}"/>
    <circle cx="196" cy="300" r="40" fill="none" stroke="${ORANGE_DEEP}" stroke-width="8"/>
    <circle cx="316" cy="300" r="40" fill="none" stroke="${ORANGE_DEEP}" stroke-width="8"/>
    <circle cx="256" cy="212" r="40" fill="none" stroke="${ORANGE_DEEP}" stroke-width="8"/>`,
  // The platinum medallion.
  flawless: `<circle cx="256" cy="256" r="126" fill="${SILVER}"/>
    <circle cx="256" cy="256" r="100" fill="none" stroke="#9aa9bb" stroke-width="8"/>
    <path d="M256 180l22 46 50 7-36 35 9 50-45-24-45 24 9-50-36-35 50-7z" fill="#9aa9bb"/>`,
  // A mortarboard with its tassel.
  'petri-scholar': `<path d="M256 150l150 60-150 60-150-60z" fill="${ORANGE}"/>
    <path d="M166 250v62c0 30 40 52 90 52s90-22 90-52v-62" stroke="${ORANGE}" stroke-width="${STROKE}" stroke-linecap="round" fill="none"/>
    <path d="M396 212v80" stroke="${CREAM}" stroke-width="16" stroke-linecap="round"/>
    <circle cx="396" cy="306" r="18" fill="${CREAM}"/>`,
  // An egg, hard boiled, with the crack it survived.
  'hard-boiled': `<path d="M256 118c-70 0-114 90-114 166a114 114 0 0 0 228 0c0-76-44-166-114-166z" fill="${CREAM}"/>
    <path d="M196 268l30-20 22 30 26-34 24 28 24-22" stroke="${ORANGE_DEEP}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
  // Two joysticks, one for each player.
  'couch-war': `<path d="M184 330v-96M328 330v-96" stroke="${ORANGE}" stroke-width="${STROKE}" stroke-linecap="round"/>
    <circle cx="184" cy="206" r="42" fill="${ORANGE}"/>
    <circle cx="328" cy="206" r="42" fill="${BLUE}"/>
    <path d="M130 344h108M274 344h108" stroke="${CREAM}" stroke-width="${STROKE}" stroke-linecap="round"/>`,
};

/** The dish of the app icon, the glyph on its agar. */
function svg(glyph: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
  <defs>
    <radialGradient id="agar" cx="50%" cy="42%" r="60%">
      <stop offset="0" stop-color="#1d3a66"/>
      <stop offset="1" stop-color="#060e19"/>
    </radialGradient>
    <linearGradient id="rim" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.85"/>
      <stop offset="0.5" stop-color="#9fc4ff" stop-opacity="0.2"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0.55"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8"/>
    </filter>
  </defs>
  <circle cx="256" cy="256" r="236" fill="url(#agar)"/>
  <circle cx="256" cy="256" r="236" fill="none" stroke="url(#rim)" stroke-width="12"/>
  <circle cx="256" cy="256" r="222" fill="none" stroke="#000000" stroke-opacity="0.35" stroke-width="10"/>
  <g filter="url(#glow)" opacity="0.55">${glyph}</g>
  ${glyph}
</svg>`;
}

async function main(): Promise<void> {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (const { id } of playGamesAchievements()) {
      const glyph = GLYPHS[id];
      if (glyph == null) {
        throw new Error(`No glyph for the achievement ${id}`);
      }
      const html = `<!doctype html><html><body style="margin:0;background:transparent">${svg(glyph)}</body></html>`;
      const png = await render(page, html, SIZE, SIZE, true);
      await writeFile(join(outDir, `${id}.png`), png);
      console.log(`${id}.png`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
