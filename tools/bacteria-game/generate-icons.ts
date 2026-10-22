/**
 * Draws the Bacteria Game app icon: two colonies of cells fighting over a
 * petri dish.
 *
 * Output: apps/bacteria-game-remote/src/icons/icon.svg, the PNGs the web app
 * manifest and iOS ask for, and apps/bacteria-game-remote/src/favicon.ico.
 * The background bleeds to the edges and the dish stays inside the central
 * 80 % safe zone, so the same picture works as a maskable icon. The cells
 * come from a seeded PRNG, so a run without changes reproduces the files.
 *
 * The Android app (apps/bacteria-wars-android) gets the same picture as its
 * launcher icon, split into the layers of an adaptive icon (plus a one-colour
 * layer for themed icons), and the dish alone for the splash screen.
 *
 * Run with `npx nx run bacteria-game-remote:icons`.
 */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { render, toIco } from '../icons/render-icons';

const srcDir = resolve('apps/bacteria-game-remote/src');
const iconsDir = join(srcDir, 'icons');
const androidResDir = resolve('apps/bacteria-wars-android/app/src/main/res');

type Point = [number, number];
/** -1 for the orange colony on the left, 1 for the blue one on the right. */
type Side = -1 | 1;

const C = 256;
const DISH_R = 186;
/** Half the width of the gap between the colonies. */
const GAP = 11;

/** A seeded pseudo-random number generator, the same numbers on every run. */
function prng(seed: number): () => number {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

/** The front line both colonies push against, as cubic bezier segments. */
const FRONT_SEGMENTS: Point[][] = [
  [
    [252, 40],
    [318, 104],
    [196, 168],
    [262, 228],
  ],
  [
    [262, 228],
    [324, 284],
    [206, 318],
    [268, 382],
  ],
  [
    [268, 382],
    [304, 420],
    [238, 450],
    [256, 480],
  ],
];

function bezier(p: Point[], t: number): Point {
  const at = (i: 0 | 1) =>
    (1 - t) ** 3 * p[0][i] +
    3 * (1 - t) ** 2 * t * p[1][i] +
    3 * (1 - t) * t ** 2 * p[2][i] +
    t ** 3 * p[3][i];
  return [at(0), at(1)];
}

const front: Point[] = FRONT_SEGMENTS.flatMap((segment) =>
  Array.from({ length: 60 }, (_, k) => bezier(segment, k / 59))
);

/** The x of the front line at height y. */
function frontX(y: number): number {
  let best = front[0];
  for (const p of front) {
    if (Math.abs(p[1] - y) < Math.abs(best[1] - y)) {
      best = p;
    }
  }
  return best[0];
}

function toPath(points: Point[]): string {
  return points.map((p) => p.map((v) => v.toFixed(1)).join(' ')).join(' L ');
}

/** A colony's territory: its half of the dish, up to its side of the gap. */
function region(side: Side): string {
  const edge = side < 0 ? 40 : 472;
  const border = front.map(([x, y]): Point => [x + side * GAP, y]);
  return `M ${edge} 40 L ${toPath(border)} L ${edge} 480 Z`;
}

interface Cell {
  x: number;
  y: number;
  r: number;
  shade: number;
}

function insideDish(x: number, y: number, margin: number): boolean {
  return Math.hypot(x - C, y - C) <= DISH_R + margin;
}

/** A jittered hex grid of cells, smaller towards the front where they divide. */
function cells(side: Side, rnd: () => number): Cell[] {
  const result: Cell[] = [];
  const step = 30;
  for (let row = 0; row * step * 0.87 < 512; row++) {
    for (let col = -1; col * step < 540; col++) {
      const x = col * step + (row % 2 ? step / 2 : 0) + (rnd() - 0.5) * 14;
      const y = row * step * 0.87 + (rnd() - 0.5) * 14;
      const depth = side * (x - frontX(y));
      if (depth < GAP + 4 || !insideDish(x, y, 12)) {
        continue;
      }
      const near = Math.min(1, (depth - GAP) / 90);
      const r = (9 + near * 7) * (0.85 + rnd() * 0.3);
      result.push({ x, y, r, shade: rnd() });
    }
  }
  // Small cells pressed right up against the front line.
  for (let y = 44; y < 476; y += 10 + rnd() * 5) {
    const r = 5.5 + rnd() * 3;
    const x = frontX(y) + side * (GAP + r + 1 + rnd() * 3);
    if (insideDish(x, y, 8)) {
      result.push({ x, y, r, shade: rnd() });
    }
  }
  return result;
}

interface Colony {
  name: string;
  side: Side;
  base: string;
  /** Highlight, body and rim colour of a cell. */
  cell: [string, string, string];
  /** Glow along the colony's edge at the front. */
  edge: string;
}

const COLONIES: Colony[] = [
  {
    name: 'orange',
    side: -1,
    base: '#c64200',
    cell: ['#ffd08a', '#ff8a2a', '#e25400'],
    edge: '#ffb15c',
  },
  {
    name: 'blue',
    side: 1,
    base: '#0636a0',
    cell: ['#a8e0ff', '#2f8cff', '#0a52d0'],
    edge: '#6cc4ff',
  },
];

/** Three cell gradients per colony, so neighbouring cells differ a little. */
function cellGradients({ name, cell: [hi, mid, lo] }: Colony): string {
  return [-0.08, 0, 0.08]
    .map(
      (
        shift,
        v
      ) => `<radialGradient id="${name}Cell${v}" cx="35%" cy="30%" r="75%">
      <stop offset="0" stop-color="${hi}"/>
      <stop offset="${(0.45 + shift).toFixed(2)}" stop-color="${mid}"/>
      <stop offset="1" stop-color="${lo}"/>
    </radialGradient>`
    )
    .join('\n    ');
}

function cellCircles({ name }: Colony, list: Cell[]): string {
  return list
    .map(
      (c) =>
        `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${c.r.toFixed(1)}" fill="url(#${name}Cell${c.shade < 0.33 ? 0 : c.shade < 0.66 ? 1 : 2})"/>`
    )
    .join('\n      ');
}

const BACKGROUND_GRADIENT = `<radialGradient id="bg" cx="50%" cy="38%" r="75%">
      <stop offset="0" stop-color="#1d3a66"/>
      <stop offset="1" stop-color="#050a14"/>
    </radialGradient>`;

interface IconOptions {
  /** The part of the 512 x 512 picture to show. */
  viewBox?: string;
  /** False leaves the backdrop around the dish transparent. */
  background?: boolean;
}

/**
 * The random parts of the picture: sparks along the front and the cells of
 * each colony, in COLONIES order. Drawn once, so every variant of the icon
 * shows the same ones.
 */
function scatter(): { sparks: string; colonyCells: Cell[][] } {
  const rnd = prng(7);
  const sparks = Array.from({ length: 14 }, () => {
    const y = 70 + rnd() * 380;
    const x = frontX(y) + (rnd() - 0.5) * 34;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(1.5 + rnd() * 3).toFixed(1)}" opacity="${(0.55 + rnd() * 0.45).toFixed(2)}"/>`;
  }).join('\n      ');
  return { sparks, colonyCells: COLONIES.map(({ side }) => cells(side, rnd)) };
}

const SCATTER = scatter();

function iconSvg({
  viewBox = '0 0 512 512',
  background = true,
}: IconOptions = {}): string {
  const { sparks } = SCATTER;
  const colonyCells = COLONIES.map((colony, i) =>
    cellCircles(colony, SCATTER.colonyCells[i])
  );
  const frontPath = 'M ' + toPath(front);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">
  <!-- Generated by tools/bacteria-game/generate-icons.ts, edit that instead. -->
  <defs>
    ${BACKGROUND_GRADIENT}
    <radialGradient id="agar" cx="50%" cy="45%" r="55%">
      <stop offset="0" stop-color="#10233b"/>
      <stop offset="1" stop-color="#060e19"/>
    </radialGradient>
    <linearGradient id="rim" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.8"/>
      <stop offset="0.5" stop-color="#9fc4ff" stop-opacity="0.15"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0.5"/>
    </linearGradient>
    <radialGradient id="vignette" cx="50%" cy="50%" r="50%">
      <stop offset="0.75" stop-color="#000000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.45"/>
    </radialGradient>
    ${COLONIES.map(cellGradients).join('\n    ')}
    <filter id="blur8" x="-50%" y="-20%" width="200%" height="140%"><feGaussianBlur stdDeviation="8"/></filter>
    <filter id="blur3" x="-50%" y="-20%" width="200%" height="140%"><feGaussianBlur stdDeviation="3"/></filter>
    <filter id="cellShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="1.6" flood-color="#000000" flood-opacity="0.55"/>
    </filter>
    <clipPath id="dish"><circle cx="${C}" cy="${C}" r="${DISH_R}"/></clipPath>
  </defs>

  ${background ? '<rect width="512" height="512" fill="url(#bg)"/>' : ''}
  <circle cx="${C}" cy="${C + 12}" r="200" fill="#000000" opacity="0.5" filter="url(#blur8)"/>
  <circle cx="${C}" cy="${C}" r="196" fill="url(#agar)"/>

  <g clip-path="url(#dish)">
    ${COLONIES.map((colony) => `<path d="${region(colony.side)}" fill="${colony.base}"/>`).join('\n    ')}
    <g filter="url(#cellShadow)">
      ${colonyCells.join('\n      ')}
    </g>

    <!-- Each colony's edge lights up in its own colour where it meets the other. -->
    ${COLONIES.map((colony) => `<path d="${region(colony.side)}" fill="none" stroke="${colony.edge}" stroke-width="10" opacity="0.8" filter="url(#blur3)"/>`).join('\n    ')}
    <path d="${frontPath}" fill="none" stroke="#fff6d8" stroke-width="16" opacity="0.5" filter="url(#blur8)"/>
    <path d="${frontPath}" fill="none" stroke="#ffffff" stroke-width="2.5" opacity="0.9" filter="url(#blur3)"/>
    <g fill="#fffbe8">
      ${sparks}
    </g>

    <circle cx="${C}" cy="${C}" r="${DISH_R}" fill="url(#vignette)"/>
    <ellipse cx="190" cy="150" rx="150" ry="80" fill="#ffffff" opacity="0.07" transform="rotate(-32 190 150)"/>
  </g>

  <circle cx="${C}" cy="${C}" r="191" fill="none" stroke="url(#rim)" stroke-width="10"/>
  <path d="M 116 156 A 168 168 0 0 1 222 90" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" opacity="0.6"/>
</svg>
`;
}

/** The backdrop alone, the background layer of the adaptive Android icon. */
function backgroundSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    ${BACKGROUND_GRADIENT}
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
</svg>
`;
}

/**
 * The dish's rim and the cells of both colonies, apart along the front, in
 * one colour: the monochrome layer Android tints for themed icons.
 */
function monochromeSvg(viewBox: string): string {
  const circles = SCATTER.colonyCells
    .flat()
    .map(
      (c) =>
        `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${(c.r * 0.8).toFixed(1)}"/>`
    )
    .join('\n    ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">
  <defs><clipPath id="dish"><circle cx="${C}" cy="${C}" r="${DISH_R}"/></clipPath></defs>
  <g fill="#ffffff" clip-path="url(#dish)">
    ${circles}
  </g>
  <circle cx="${C}" cy="${C}" r="191" fill="none" stroke="#ffffff" stroke-width="12"/>
</svg>
`;
}

function iconPage(svg: string, size: number): string {
  return `<!doctype html>
<html><head><style>
  html, body { margin: 0; }
  svg { display: block; width: ${size}px; height: ${size}px; }
</style></head>
<body>${svg}</body></html>`;
}

/** Manifest icons (any and maskable share one picture) and the iOS icon. */
const PNG_ICONS: Array<{ file: string; size: number }> = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
];
const FAVICON_SIZES = [16, 32, 48];

/** Android's screen densities: pixels per dp. */
const ANDROID_DENSITIES: Record<string, number> = {
  mdpi: 1,
  hdpi: 1.5,
  xhdpi: 2,
  xxhdpi: 3,
  xxxhdpi: 4,
};

/**
 * The Android images: `dir` and `file` within res, their size in dp. The
 * adaptive icon is 108 dp, of which launchers show at least the central
 * 66 dp circle, so the dish shrinks to that circle on its layers. Where the
 * backdrop is transparent, the dish leaves room for its drop shadow, which
 * reaches about 40 units further down.
 */
function androidImages(): Array<{
  dir: string;
  file: string;
  dp: number;
  svg: string;
}> {
  // The viewBox that shows the dish (radius 196 with its rim) dishDp wide on
  // an image imageDp wide.
  const dishView = (dishDp: number, imageDp: number): string => {
    const half = (196 * imageDp) / dishDp;
    return `${C - half} ${C - half} ${2 * half} ${2 * half}`;
  };
  return [
    // Launchers before Android 8 have no adaptive icons and show this one
    // as it is, so it gets the round dish without the square around it.
    {
      dir: 'mipmap',
      file: 'ic_launcher.png',
      dp: 48,
      svg: iconSvg({ viewBox: dishView(40, 48), background: false }),
    },
    {
      dir: 'mipmap',
      file: 'ic_launcher_foreground.png',
      dp: 108,
      svg: iconSvg({ viewBox: dishView(66, 108), background: false }),
    },
    {
      dir: 'mipmap',
      file: 'ic_launcher_monochrome.png',
      dp: 108,
      svg: monochromeSvg(dishView(66, 108)),
    },
    {
      dir: 'mipmap',
      file: 'ic_launcher_background.png',
      dp: 108,
      svg: backgroundSvg(),
    },
    {
      dir: 'drawable',
      file: 'splash.png',
      dp: 160,
      svg: iconSvg({ viewBox: dishView(128, 160), background: false }),
    },
  ];
}

async function main(): Promise<void> {
  const svg = iconSvg();
  await mkdir(iconsDir, { recursive: true });
  await writeFile(join(iconsDir, 'icon.svg'), svg);
  console.log('wrote icons/icon.svg');

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (const { file, size } of PNG_ICONS) {
      await writeFile(
        join(iconsDir, file),
        await render(page, iconPage(svg, size), size, size, true)
      );
      console.log(`wrote icons/${file}`);
    }

    const favicons: Array<{ size: number; png: Buffer }> = [];
    for (const size of FAVICON_SIZES) {
      favicons.push({
        size,
        png: await render(page, iconPage(svg, size), size, size, true),
      });
    }
    await writeFile(join(srcDir, 'favicon.ico'), toIco(favicons));
    console.log('wrote favicon.ico');

    for (const { dir, file, dp, svg } of androidImages()) {
      for (const [density, scale] of Object.entries(ANDROID_DENSITIES)) {
        const size = Math.round(dp * scale);
        const densityDir = join(androidResDir, `${dir}-${density}`);
        await mkdir(densityDir, { recursive: true });
        await writeFile(
          join(densityDir, file),
          await render(page, iconPage(svg, size), size, size, true)
        );
        console.log(`wrote android ${dir}-${density}/${file}`);
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
