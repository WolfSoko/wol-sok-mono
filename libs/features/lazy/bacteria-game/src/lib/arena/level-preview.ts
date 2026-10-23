import { arenaSize } from '../state/arena-size';
import {
  DEFAULT_COLORS,
  getColonyColor,
  NEUTRAL_COLOR,
} from '../state/colony-colors';
import { getLevel, levelBalance, levelMap, levelSize } from '../state/levels';
import { DynamicWall, Rect } from '../state/maps';
import { spawnSpots } from '../state/shapes';
import { mapZones, Zone } from '../state/zones';
import {
  BLOB_ALPHA,
  BLOB_LAYERS,
  blobColor,
  blobLayer,
  paintArenaBackground,
} from './arena-renderer';
import { ArenaTheme, arenaTheme, Rgb } from './arena-theme';
import { hash, mix, rgba } from './canvas-math';
import { darker } from './colony-renderer';
import { paintZoneLayer } from './zone-decal';

/** The size of a level preview in pixels - 16:9, like the base arena. */
export const PREVIEW_WIDTH = 640;
export const PREVIEW_HEIGHT = 360;

/**
 * The radius of the preview's rounded corners, as a share of its height.
 * The menus round the image by as much (`border-radius: 4.5% / 8%`), so the
 * frame drawn into it follows the clipped edge.
 */
export const PREVIEW_CORNER = 0.08;

/** Who a colony on a preview is - it decides its colour and its look. */
export type PreviewColonyRole = 'left' | 'right' | 'boss' | 'neutral';

/** A colony where it starts, in cells of the map. */
export interface PreviewColony {
  role: PreviewColonyRole;
  x: number;
  y: number;
  /** Its start radius, in cells. */
  radius: number;
  color: Rgb;
}

/**
 * Everything a level preview shows, in cells of the level's map at the
 * normal grid - what the simulation lays out at the start of a match.
 */
export interface LevelPreviewScene {
  levelId: string;
  /** The map in cells: the base arena times its size. */
  width: number;
  height: number;
  /** How many times the base arena the map is along each side. */
  size: number;
  theme: ArenaTheme;
  walls: readonly Rect[];
  /** The gates and sliding walls as they stand when the match starts. */
  dynamicWalls: readonly DynamicWall[];
  zones: readonly Zone[];
  /** The two players' colonies, then the neutral ones. */
  colonies: readonly PreviewColony[];
}

/**
 * What the preview of a level shows: its walls, zones and moving walls at
 * time 0 on the whole map, the two colonies on their spawn spots - orange
 * left, blue right, or a boss there - and the neutral colonies, all from
 * the data the simulation plays. A generated level gets one like any other.
 */
export function levelPreviewScene(levelId: string): LevelPreviewScene {
  const level = getLevel(levelId);
  const map = levelMap(level);
  const size = levelSize(level);
  const { width, height } = arenaSize('normal', size);
  // On a bigger map the colonies start as big as on a base one.
  const radius = levelBalance(level).startBacteriaRadius;
  const [leftSpot, rightSpot] = spawnSpots(width, height);
  const [leftColor, rightColor] = DEFAULT_COLORS.map(
    (id) => getColonyColor(id).rgb
  );
  const boss = level.boss;
  const neutral: Rgb = [NEUTRAL_COLOR[0], NEUTRAL_COLOR[1], NEUTRAL_COLOR[2]];
  return {
    levelId: level.id,
    width,
    height,
    size,
    theme: arenaTheme(level.id),
    walls: map.createWalls(width, height),
    dynamicWalls: map.createDynamicWalls?.(width, height, 0) ?? [],
    zones: mapZones(map, width, height),
    colonies: [
      { role: 'left', ...leftSpot, radius, color: leftColor },
      {
        role: boss === undefined ? 'right' : 'boss',
        ...rightSpot,
        // The scale is one of area: the radius grows by its root.
        radius: radius * Math.sqrt(boss?.startScale ?? 1),
        color: rightColor,
      },
      ...(level.neutrals ?? []).map((spot): PreviewColony => ({
        role: 'neutral',
        x: Math.round(spot.x * width),
        y: Math.round(spot.y * height),
        radius: radius * Math.sqrt(spot.startScale),
        color: neutral,
      })),
    ],
  };
}

/** Preview pixels per cell of the map - all of it fits the preview. */
export function previewScale(
  scene: Pick<LevelPreviewScene, 'width' | 'height'>,
  width = PREVIEW_WIDTH,
  height = PREVIEW_HEIGHT
): number {
  return Math.min(width / scene.width, height / scene.height);
}

/**
 * The smallest a colony is drawn, as a share of the preview's width: on a
 * big map a colony is a few pixels across, too small to tell apart.
 */
export const MIN_COLONY_SHARE = 0.03;

/** How far a colony reaches on the preview, in preview pixels. */
export function colonyRadius(
  colony: PreviewColony,
  scale: number,
  width = PREVIEW_WIDTH
): number {
  const least = width * MIN_COLONY_SHARE * (colony.role === 'boss' ? 1.5 : 1);
  return Math.max(colony.radius * scale, least);
}

/** The pixel layers a preview is painted from, painted once per level. */
export interface PreviewLayers {
  /** The arena's floor, as the game paints it - stretched over the preview. */
  floor: CanvasImageSource | null;
  /** The zones, as the game paints them - stretched over the preview. */
  zones: CanvasImageSource | null;
  /** A tile of fine noise, laid over all of it. */
  grain: CanvasImageSource | null;
}

/** The context a preview is drawn on. */
export type PreviewContext = OffscreenCanvasRenderingContext2D;

/**
 * Paints a level preview: the floor and the zones, the walls with a soft
 * shadow, the moving walls, the colonies glowing on their spots - and over
 * it the look of a dish under the microscope: a vignette, a fine grain, a
 * glint on the glass and a rounded frame in the arena's edge colour.
 */
export function paintLevelPreview(
  cx: PreviewContext,
  scene: LevelPreviewScene,
  layers: PreviewLayers,
  width = PREVIEW_WIDTH,
  height = PREVIEW_HEIGHT
): void {
  const { theme } = scene;
  const scale = previewScale(scene, width, height);
  cx.save();
  cx.fillStyle = rgba(theme.floor);
  cx.fillRect(0, 0, width, height);
  cx.imageSmoothingEnabled = true;
  if (layers.floor !== null) {
    cx.drawImage(layers.floor, 0, 0, width, height);
  }
  if (layers.zones !== null) {
    cx.drawImage(layers.zones, 0, 0, width, height);
  }

  // The map in cells from here on.
  cx.save();
  cx.scale(scale, scale);
  cx.shadowColor = 'rgba(0,0,0,0.55)';
  cx.shadowBlur = 6;
  cx.shadowOffsetY = 2;
  drawWalls(cx, scene.walls, theme);
  drawDynamicWalls(cx, scene.dynamicWalls, theme);
  cx.restore();

  for (const colony of scene.colonies) {
    drawColony(cx, colony, scale, width);
  }

  drawDish(cx, theme, layers.grain, width, height);
  cx.restore();
}

/** The static walls, as the arena draws them: rimmed blobs, lit blocks. */
function drawWalls(
  cx: PreviewContext,
  walls: readonly Rect[],
  theme: ArenaTheme
): void {
  drawBlobs(cx, walls, darker(theme.wall), theme);
  for (const wall of walls) {
    if (wall.round) {
      continue;
    }
    cx.fillStyle = rgba(theme.wall);
    cx.fillRect(wall.x, wall.y, wall.width, wall.height);
  }
  // The lit edges without a shadow of their own.
  cx.save();
  cx.shadowColor = 'transparent';
  cx.fillStyle = rgba(theme.wallEdge);
  for (const wall of walls) {
    if (!wall.round) {
      cx.fillRect(wall.x, wall.y, wall.width, 1);
      cx.fillRect(wall.x, wall.y, 1, wall.height);
    }
  }
  cx.restore();
}

/**
 * The gates and sliding walls at the start: a closed one a block striped
 * in the frame colour, an open gate a faint dashed outline.
 */
function drawDynamicWalls(
  cx: PreviewContext,
  walls: readonly DynamicWall[],
  theme: ArenaTheme
): void {
  drawBlobs(cx, walls, theme.border, theme);
  for (const wall of walls) {
    if (wall.round || wall.width <= 0 || wall.height <= 0) {
      continue;
    }
    if (wall.solid) {
      cx.fillStyle = rgba(theme.border);
      cx.fillRect(wall.x, wall.y, wall.width, wall.height);
      hazardStripes(cx, wall, theme);
      continue;
    }
    cx.save();
    cx.shadowColor = 'transparent';
    cx.fillStyle = rgba(theme.border, 0.12);
    cx.fillRect(wall.x, wall.y, wall.width, wall.height);
    cx.strokeStyle = rgba(theme.border, 0.75);
    cx.lineWidth = 1;
    cx.setLineDash([2, 2]);
    cx.strokeRect(wall.x + 0.5, wall.y + 0.5, wall.width - 1, wall.height - 1);
    cx.restore();
  }
}

/** Dark diagonals across a closed wall, three cells apart. */
function hazardStripes(
  cx: PreviewContext,
  wall: Rect,
  theme: ArenaTheme
): void {
  cx.save();
  cx.shadowColor = 'transparent';
  cx.beginPath();
  cx.rect(wall.x, wall.y, wall.width, wall.height);
  cx.clip();
  cx.strokeStyle = rgba(theme.rim, 0.7);
  cx.lineWidth = 1.5;
  cx.beginPath();
  for (let d = -wall.height; d < wall.width; d += 3) {
    cx.moveTo(wall.x + d, wall.y + wall.height);
    cx.lineTo(wall.x + d + wall.height, wall.y);
  }
  cx.stroke();
  cx.restore();
}

/** The round walls among these, pass by pass, as the arena draws them. */
function drawBlobs(
  cx: PreviewContext,
  walls: readonly Rect[],
  rim: Rgb,
  theme: ArenaTheme
): void {
  if (!walls.some((wall) => wall.round)) {
    return;
  }
  const shape: Rect = { x: 0, y: 0, width: 0, height: 0 };
  for (let layer = 0; layer < BLOB_LAYERS; layer++) {
    cx.fillStyle = rgba(blobColor(layer, rim, theme), BLOB_ALPHA[layer]);
    cx.beginPath();
    for (const wall of walls) {
      if (wall.round) {
        const { x, y, width, height } = blobLayer(layer, wall, shape);
        cx.moveTo(x + width, y + height / 2);
        cx.ellipse(
          x + width / 2,
          y + height / 2,
          width / 2,
          height / 2,
          0,
          0,
          2 * Math.PI
        );
      }
    }
    cx.fill();
    // Only the first pass casts the shadow.
    cx.shadowColor = 'transparent';
  }
}

/** The colour a boss's spikes and aura burn in. */
const BOSS_RED: Rgb = [220, 30, 45];

/**
 * A colony on its spot: a soft glow, a lumpy body lit from the top left,
 * bacteria strewn round it. A boss is bigger and bristles: spikes, a red
 * aura and two narrowed eyes.
 */
function drawColony(
  cx: PreviewContext,
  colony: PreviewColony,
  scale: number,
  width: number
): void {
  const x = colony.x * scale;
  const y = colony.y * scale;
  const r = colonyRadius(colony, scale, width);
  const boss = colony.role === 'boss';
  const neutral = colony.role === 'neutral';
  const seed = Math.round(colony.x * 31 + colony.y * 17);

  cx.save();
  cx.globalCompositeOperation = 'lighter';
  glow(cx, x, y, r * (boss ? 3.2 : 2.6), boss ? BOSS_RED : colony.color, {
    alpha: neutral ? 0.25 : boss ? 0.6 : 0.5,
  });
  cx.restore();

  if (boss) {
    cx.fillStyle = rgba(mix(colony.color, BOSS_RED, 0.65));
    cx.strokeStyle = rgba(mix(BOSS_RED, [255, 255, 255], 0.3), 0.9);
    cx.lineWidth = Math.max(1, r * 0.06);
    spikes(cx, x, y, r * 1.02, r * 1.6, 13, seed);
    cx.fill();
    cx.stroke();
  }

  // Bacteria straying from the colony.
  cx.fillStyle = rgba(mix(colony.color, [255, 255, 255], 0.2), 0.85);
  const strays = neutral ? 7 : 12;
  for (let i = 0; i < strays; i++) {
    const angle = hash(i, seed, 11) * Math.PI * 2;
    const reach = r * (1.08 + hash(i, seed, 12) * (boss ? 0.8 : 0.55));
    cx.beginPath();
    cx.arc(
      x + Math.cos(angle) * reach,
      y + Math.sin(angle) * reach,
      Math.max(0.8, r * (0.05 + hash(i, seed, 13) * 0.05)),
      0,
      Math.PI * 2
    );
    cx.fill();
  }

  const body = cx.createRadialGradient(
    x - r * 0.35,
    y - r * 0.4,
    r * 0.1,
    x,
    y,
    r * 1.05
  );
  body.addColorStop(0, rgba(mix(colony.color, [255, 255, 255], 0.55)));
  body.addColorStop(0.55, rgba(colony.color));
  body.addColorStop(1, rgba(darker(colony.color)));
  cx.fillStyle = body;
  lumpy(cx, x, y, r, seed);
  cx.fill();
  cx.strokeStyle = rgba(mix(colony.color, [255, 255, 255], 0.45), 0.7);
  cx.lineWidth = Math.max(1, r * 0.07);
  cx.stroke();

  if (boss) {
    eyes(cx, x, y, r);
  }
}

/** A round glow of a colour, fading out to `reach`. */
function glow(
  cx: PreviewContext,
  x: number,
  y: number,
  reach: number,
  color: Rgb,
  { alpha }: { alpha: number }
): void {
  const light = cx.createRadialGradient(x, y, 0, x, y, reach);
  light.addColorStop(0, rgba(color, alpha));
  light.addColorStop(0.35, rgba(color, alpha * 0.45));
  light.addColorStop(1, rgba(color, 0));
  cx.fillStyle = light;
  cx.fillRect(x - reach, y - reach, reach * 2, reach * 2);
}

/** A round outline that wobbles a little - a colony, not a coin. */
function lumpy(
  cx: PreviewContext,
  x: number,
  y: number,
  r: number,
  seed: number
): void {
  const points = 28;
  cx.beginPath();
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const wobble = 1 + (hash(i % points, seed, 21) - 0.5) * 0.14;
    const px = x + Math.cos(angle) * r * wobble;
    const py = y + Math.sin(angle) * r * wobble;
    if (i === 0) {
      cx.moveTo(px, py);
    } else {
      cx.lineTo(px, py);
    }
  }
  cx.closePath();
}

/** A star of `count` spikes between two radii, each a little uneven. */
function spikes(
  cx: PreviewContext,
  x: number,
  y: number,
  inner: number,
  outer: number,
  count: number,
  seed: number
): void {
  cx.beginPath();
  for (let i = 0; i < count * 2; i++) {
    const angle = (i / (count * 2)) * Math.PI * 2 - Math.PI / 2;
    const tip = i % 2 === 0;
    const reach = tip
      ? outer * (0.85 + hash(i, seed, 31) * 0.3)
      : inner * (0.95 + hash(i, seed, 32) * 0.05);
    const px = x + Math.cos(angle) * reach;
    const py = y + Math.sin(angle) * reach;
    if (i === 0) {
      cx.moveTo(px, py);
    } else {
      cx.lineTo(px, py);
    }
  }
  cx.closePath();
}

/** Two narrowed eyes glaring from a boss. */
function eyes(cx: PreviewContext, x: number, y: number, r: number): void {
  const w = r * 0.32;
  const h = r * 0.16;
  for (const side of [-1, 1]) {
    const ex = x + side * r * 0.32;
    const ey = y - r * 0.08;
    cx.beginPath();
    // A slanted slit, its inner corner pulled down - a frown.
    cx.moveTo(ex - side * w * 0.5, ey + h * 0.6);
    cx.lineTo(ex + side * w * 0.5, ey - h * 0.6);
    cx.lineTo(ex + side * w * 0.4, ey + h * 0.5);
    cx.closePath();
    cx.fillStyle = 'rgba(255,236,120,0.95)';
    cx.fill();
  }
}

/**
 * The dish over it all: the corners darker, a fine grain, a glint on the
 * glass and the rounded frame in the arena's edge colour, glowing inwards.
 */
function drawDish(
  cx: PreviewContext,
  theme: ArenaTheme,
  grain: CanvasImageSource | null,
  width: number,
  height: number
): void {
  const vignette = cx.createRadialGradient(
    width / 2,
    height / 2,
    height * 0.35,
    width / 2,
    height / 2,
    Math.hypot(width, height) / 2
  );
  vignette.addColorStop(0, rgba(theme.rim, 0));
  vignette.addColorStop(1, rgba(theme.rim, 0.7));
  cx.fillStyle = vignette;
  cx.fillRect(0, 0, width, height);

  if (grain !== null) {
    const pattern = cx.createPattern(grain, 'repeat');
    if (pattern !== null) {
      cx.save();
      cx.globalAlpha = 0.1;
      cx.globalCompositeOperation = 'overlay';
      cx.fillStyle = pattern;
      cx.fillRect(0, 0, width, height);
      cx.restore();
    }
  }

  const glint = cx.createRadialGradient(
    width * 0.22,
    height * 0.12,
    0,
    width * 0.22,
    height * 0.12,
    width * 0.45
  );
  glint.addColorStop(0, 'rgba(255,255,255,0.13)');
  glint.addColorStop(1, 'rgba(255,255,255,0)');
  cx.fillStyle = glint;
  cx.fillRect(0, 0, width, height);

  const corner = height * PREVIEW_CORNER;
  const line = Math.max(2, height * 0.012);
  cx.save();
  cx.shadowColor = rgba(theme.border, 0.8);
  cx.shadowBlur = line * 4;
  cx.strokeStyle = rgba(theme.border, 0.9);
  cx.lineWidth = line;
  cx.beginPath();
  cx.roundRect(line / 2, line / 2, width - line, height - line, corner);
  cx.stroke();
  cx.restore();
  // A thin bright line on the glass, inside the frame.
  cx.strokeStyle = rgba(mix(theme.border, [255, 255, 255], 0.6), 0.35);
  cx.lineWidth = 1;
  cx.beginPath();
  cx.roundRect(
    line * 1.75,
    line * 1.75,
    width - line * 3.5,
    height - line * 3.5,
    Math.max(0, corner - line)
  );
  cx.stroke();
}

/** Fine noise around mid grey: laid over the preview, it reads as grain. */
export function grainPixels(size: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const value = 96 + hash(i % size, Math.floor(i / size), 5) * 64;
    data.set([value, value, value, 255], i * 4);
  }
  return data;
}

/**
 * The floor of the scene's arena as the game paints it, one pixel per cell
 * - at most as wide as the preview, the pattern only blurs beyond.
 */
export function floorPixels(scene: LevelPreviewScene): {
  data: Uint8ClampedArray;
  width: number;
  height: number;
} {
  const shrink = Math.min(1, PREVIEW_WIDTH / scene.width);
  const width = Math.round(scene.width * shrink);
  const height = Math.round(scene.height * shrink);
  return {
    data: paintArenaBackground(
      new Uint8ClampedArray(width * height * 4),
      width,
      height,
      scene.theme
    ),
    width,
    height,
  };
}

/** The zones of the scene as the game paints them, null without any. */
export function zonePixels(
  scene: LevelPreviewScene
): ReturnType<typeof paintZoneLayer> {
  // As fine as the preview shows them, the marks as big as on a base map.
  return paintZoneLayer(
    scene.width,
    scene.height,
    scene.zones,
    previewScale(scene),
    1
  );
}
