import type { CapturedLayer } from '@wolsok/feat-bacteria-rendering';

/** How long a saved sheet's address stays valid for the download. */
const REVOKE_AFTER_MS = 60_000;

/** The height of the row with a layer's name above it, in pixels. */
export const LABEL_HEIGHT = 18;

/** Where a layer goes on the sheet. */
export interface SheetPlacement {
  label: string;
  /** The top of its label row. */
  labelY: number;
  /** The top of its pictures, under the label. */
  imageY: number;
  /** The left of its alpha picture, right of its colours. */
  alphaX: number;
}

/**
 * The GL diagnostic's sheet: the layers one under the other, each under a
 * row with its name, its colours on the left and its alpha beside them -
 * the glow packs colony ids into its alpha, so that is half of what to see.
 */
export function sheetLayout(
  layers: readonly Pick<CapturedLayer, 'label' | 'width' | 'height'>[]
): { width: number; height: number; placements: SheetPlacement[] } {
  let top = 0;
  const placements = layers.map(({ label, width, height }) => {
    const placement = {
      label,
      labelY: top,
      imageY: top + LABEL_HEIGHT,
      alphaX: width,
    };
    top += LABEL_HEIGHT + height;
    return placement;
  });
  return {
    width: Math.max(0, ...layers.map((layer) => layer.width * 2)),
    height: top,
    placements,
  };
}

/** A layer's RGBA as its colours, opaque, and its alpha as grey. */
export function splitAlpha(pixels: Uint8Array): {
  colors: Uint8ClampedArray<ArrayBuffer>;
  alpha: Uint8ClampedArray<ArrayBuffer>;
} {
  const colors = new Uint8ClampedArray(pixels);
  const alpha = new Uint8ClampedArray(pixels.length);
  for (let i = 0; i < pixels.length; i += 4) {
    const a = pixels[i + 3];
    colors[i + 3] = 255;
    alpha[i] = a;
    alpha[i + 1] = a;
    alpha[i + 2] = a;
    alpha[i + 3] = 255;
  }
  return { colors, alpha };
}

/** Draws the sheet of the layers - null where the canvas gives no 2D context. */
function drawSheet(layers: readonly CapturedLayer[]): HTMLCanvasElement | null {
  const { width, height, placements } = sheetLayout(layers);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const cx = canvas.getContext('2d');
  if (cx == null) {
    return null;
  }
  cx.fillStyle = '#000';
  cx.fillRect(0, 0, width, height);
  cx.font = `${LABEL_HEIGHT - 4}px monospace`;
  cx.textBaseline = 'top';
  layers.forEach((layer, index) => {
    const { label, labelY, imageY, alphaX } = placements[index];
    cx.fillStyle = '#fff';
    cx.fillText(
      `${label} (${layer.width}×${layer.height}) · alpha`,
      2,
      labelY + 2
    );
    const { colors, alpha } = splitAlpha(layer.pixels);
    cx.putImageData(
      new ImageData(colors, layer.width, layer.height),
      0,
      imageY
    );
    cx.putImageData(
      new ImageData(alpha, layer.width, layer.height),
      alphaX,
      imageY
    );
  });
  return canvas;
}

/**
 * Saves the layers as one PNG, `bacteria-gl-layers-<time>.png`, through the
 * browser's download - on a phone too, which has no dev tools to read them
 * with.
 */
export function downloadLayerSheet(layers: readonly CapturedLayer[]): void {
  if (layers.length === 0) {
    console.warn('GL layers: no GL painter is diagnosed, nothing to save');
    return;
  }
  const canvas = drawSheet(layers);
  if (canvas == null) {
    console.warn('GL layers: the browser gave no canvas to draw them on');
    return;
  }
  canvas.toBlob((blob) => {
    if (blob == null) {
      console.warn(
        `GL layers: the browser could not encode the ${canvas.width}×${canvas.height} sheet`
      );
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bacteria-gl-layers-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
    link.click();
    // A phone may still be fetching it when the click returns.
    setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
  }, 'image/png');
}
