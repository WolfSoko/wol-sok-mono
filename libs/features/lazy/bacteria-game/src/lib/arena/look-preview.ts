import { BacteriaLook } from '../state/skins';
import { gameBalance } from '../state/game-balance';
import { CellBounds } from '../state/geometry';
import { Bacteria } from '../state/player.model';
import { createCanvas } from './canvas-math';
import {
  colonyDensity,
  createImageDataFromBacterias,
  LOOKS,
  paintColony,
  SLIME_SCALE,
} from './colony-renderer';

/** The arena of a look preview, in cells - 16:9, like the real one. */
export interface PreviewSize {
  width: number;
  height: number;
}

/** A skin's tile in the gallery. */
export const SKIN_PREVIEW: PreviewSize = { width: 64, height: 36 };
/** The player's colony at the top of the My Colony screen. */
export const HERO_PREVIEW: PreviewSize = { width: 160, height: 90 };

/** The agar of the dish behind a preview, as on the app icon. */
const AGAR_CENTRE = '#10233b';
const AGAR_EDGE = '#060e19';

/** How the sample colony lives, with `timeSec`: how far it drifts, breathes and ripples. */
const LIFE = {
  /** The drift of its centre, as a share of the arena, and how fast. */
  driftX: 0.025,
  driftY: 0.04,
  driftRate: 0.55,
  /** How much it swells and shrinks, and how fast. */
  breath: 0.035,
  breathRate: 0.9,
  /** The ripple of its edge: two waves, how deep and how fast they run. */
  ripple: 0.08,
  rippleRate: 1.3,
  swell: 0.05,
  swellRate: 0.7,
} as const;

/**
 * The sample colony of a preview: a blob with a wavy edge filling most of
 * the arena, weaker towards its right - a front - so a look shows what it
 * makes of both. With `timeSec` it lives like a colony in the dish: it
 * drifts a little, breathes, and its edge ripples as if the bacteria along
 * it were on the move.
 */
export function previewColony(
  { width, height }: PreviewSize,
  timeSec = 0
): Bacteria[] {
  const t = timeSec;
  const cx = width * 0.5 + width * LIFE.driftX * Math.sin(t * LIFE.driftRate);
  const cy =
    height * 0.5 + height * LIFE.driftY * Math.cos(t * LIFE.driftRate * 0.8);
  const breath = 1 + LIFE.breath * Math.sin(t * LIFE.breathRate);
  const rx = width * 0.4 * breath;
  const ry = height * 0.4 * breath;
  const colony: Bacteria[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      const wobble =
        1 +
        LIFE.ripple * Math.sin(x * 0.7 + t * LIFE.rippleRate) +
        LIFE.ripple * Math.cos(y * 0.5 - t * LIFE.rippleRate * 0.85) +
        LIFE.swell * Math.sin((x + y) * 0.18 + t * LIFE.swellRate);
      if (d <= wobble) {
        const front = Math.max(0, (x - cx) / rx);
        colony.push({
          x,
          y,
          energy: gameBalance.maxEnergy * (0.35 + 0.65 * (1 - front)),
        });
      }
    }
  }
  return colony;
}

/**
 * The sample colony drawn in a look, as the layer the painters make: RGBA
 * pixels, {@link SLIME_SCALE} per cell for a look drawn from the density,
 * one per cell for the pixels. `timeSec` moves the colony, and a look that
 * moves with it.
 */
export function renderLookLayer(
  look: BacteriaLook,
  color: readonly number[],
  size: PreviewSize,
  timeSec = 0
): { data: Uint8ClampedArray<ArrayBuffer>; width: number; height: number } {
  const { width, height } = size;
  const rgba = [color[0], color[1], color[2], 255];
  const colony = previewColony(size, timeSec);
  if (look === 'pixels') {
    const data = new Uint8ClampedArray(width * height * 4);
    createImageDataFromBacterias(data, width, rgba, colony);
    return { data, width, height };
  }
  const cells = width * height;
  const density = new Float32Array(cells);
  const heat = new Float32Array(cells);
  const region: CellBounds = {
    minX: 0,
    minY: 0,
    maxX: width - 1,
    maxY: height - 1,
  };
  const hot = colonyDensity(
    density,
    heat,
    new Float32Array(cells),
    width,
    height,
    colony,
    gameBalance,
    region
  );
  const data = new Uint8ClampedArray(cells * SLIME_SCALE * SLIME_SCALE * 4);
  paintColony(
    look,
    data,
    density,
    hot ? heat : null,
    width,
    height,
    rgba,
    null,
    1,
    region,
    region,
    timeSec
  );
  return { data, width: width * SLIME_SCALE, height: height * SLIME_SCALE };
}

/**
 * Draws a look's preview onto a canvas: the agar of the dish, and the
 * sample colony in the look, scaled to the canvas - smoothly for a look
 * drawn from the density, crisp for the pixels. False where the browser
 * gives no drawing context.
 */
export function paintLookPreview(
  cx: CanvasRenderingContext2D,
  look: BacteriaLook,
  color: readonly number[],
  size: PreviewSize,
  timeSec = 0
): boolean {
  const layer = renderLookLayer(look, color, size, timeSec);
  const offscreen = createCanvas(layer.width, layer.height);
  const layerContext = offscreen?.getContext('2d') ?? null;
  if (offscreen == null || layerContext == null) {
    return false;
  }
  layerContext.putImageData(
    new ImageData(layer.data, layer.width, layer.height),
    0,
    0
  );
  const { width, height } = cx.canvas;
  const agar = cx.createRadialGradient(
    width * 0.5,
    height * 0.45,
    0,
    width * 0.5,
    height * 0.5,
    width * 0.6
  );
  agar.addColorStop(0, AGAR_CENTRE);
  agar.addColorStop(1, AGAR_EDGE);
  cx.fillStyle = agar;
  cx.fillRect(0, 0, width, height);
  cx.imageSmoothingEnabled = LOOKS[look].fromDensity;
  cx.drawImage(offscreen, 0, 0, width, height);
  return true;
}
