import { inject, Injectable, InjectionToken, signal } from '@angular/core';
import {
  floorPixels,
  grainPixels,
  levelPreviewScene,
  paintLevelPreview,
  PREVIEW_HEIGHT,
  PREVIEW_WIDTH,
  zonePixels,
} from '../arena/level-preview';
import { keepRecent } from '../state/recent-cache';

/** Draws the preview image of a level. */
export interface LevelPreviewRenderer {
  /**
   * False where nothing can be drawn - no canvas off the page, as in the
   * test DOM or on a server: the menus show the colour cards then.
   */
  readonly supported: boolean;
  /** The preview of the level as an image URL, null where it failed. */
  render(levelId: string): Promise<string | null>;
}

/** What draws the level previews - the browser's canvas, unless replaced. */
export const LEVEL_PREVIEW_RENDERER = new InjectionToken<LevelPreviewRenderer>(
  'LEVEL_PREVIEW_RENDERER',
  { providedIn: 'root', factory: () => canvasPreviewRenderer() }
);

/**
 * How many previews are kept. More than the ladder has levels, so the level
 * map never draws one of them twice - only the generated ones come and go.
 */
export const PREVIEW_CACHE_LIMIT = 64;

/**
 * The preview images of the levels, drawn once per level id and kept.
 *
 * A preview is asked for where it is shown, and drawn later, one at a time
 * while the browser idles, so opening the level map with all its cards stays
 * quick: until its image is drawn a card shows its colours. Asking again
 * before then waits for the same drawing.
 */
@Injectable({ providedIn: 'root' })
export class LevelPreviewService {
  private readonly renderer = inject(LEVEL_PREVIEW_RENDERER);

  /** True where previews are drawn at all. */
  public readonly supported = this.renderer.supported;

  private readonly urls = new Map<string, string>();
  /** Asked for and not drawn yet, in the order asked. */
  private readonly waiting = new Set<string>();
  /** The levels whose preview failed - not tried again. */
  private readonly failed = new Set<string>();
  /** Counts the previews drawn, so a computed reading a URL follows them. */
  private readonly drawn = signal(0);
  private drawing = false;

  /**
   * The preview of the level, null until it is drawn - asking for it
   * starts the drawing. Reading it in a computed follows the drawing.
   */
  public url(levelId: string): string | null {
    this.drawn();
    const url = this.urls.get(levelId);
    if (url !== undefined) {
      return url;
    }
    this.request(levelId);
    return null;
  }

  private request(levelId: string): void {
    if (
      !this.supported ||
      this.waiting.has(levelId) ||
      this.failed.has(levelId)
    ) {
      return;
    }
    this.waiting.add(levelId);
    if (!this.drawing) {
      this.drawing = true;
      whenIdle(() => void this.drawNext());
    }
  }

  /** Draws the preview asked for first, then waits for idle time again. */
  private async drawNext(): Promise<void> {
    const [levelId] = this.waiting;
    let url: string | null = null;
    try {
      url = await this.renderer.render(levelId);
    } catch {
      url = null;
    }
    if (url === null) {
      this.failed.add(levelId);
    } else {
      keepRecent(this.urls, levelId, url, PREVIEW_CACHE_LIMIT);
    }
    this.waiting.delete(levelId);
    this.drawn.update((count) => count + 1);
    if (this.waiting.size > 0) {
      whenIdle(() => void this.drawNext());
    } else {
      this.drawing = false;
    }
  }
}

/** Runs the callback once the browser idles - or soon, where it cannot say. */
function whenIdle(callback: () => void): void {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(callback, { timeout: 400 });
  } else {
    setTimeout(callback, 0);
  }
}

/**
 * Draws the previews on a canvas off the page and hands them out as data
 * URLs - WebP, or JPEG where the browser cannot write WebP. Without an
 * `OffscreenCanvas` - the test DOM, a server - it draws nothing.
 */
export function canvasPreviewRenderer(): LevelPreviewRenderer {
  const supported =
    typeof OffscreenCanvas === 'function' && typeof FileReader === 'function';
  let grain: OffscreenCanvas | null | undefined;
  return {
    supported,
    render: async (levelId) => {
      if (!supported) {
        return null;
      }
      const scene = levelPreviewScene(levelId);
      const canvas = new OffscreenCanvas(PREVIEW_WIDTH, PREVIEW_HEIGHT);
      const cx = canvas.getContext('2d');
      if (cx === null) {
        return null;
      }
      grain ??= pixelCanvas(grainPixels(GRAIN_TILE), GRAIN_TILE, GRAIN_TILE);
      const floor = floorPixels(scene);
      const zones = zonePixels(scene);
      paintLevelPreview(cx, scene, {
        floor: pixelCanvas(floor.data, floor.width, floor.height),
        zones:
          zones === null
            ? null
            : pixelCanvas(zones.data, zones.width, zones.height),
        grain,
      });
      return dataUrl(await encode(canvas));
    },
  };
}

/** The side of the grain tile, in pixels. */
const GRAIN_TILE = 96;

/** RGBA pixels on a canvas of their own, or null where it gets no context. */
function pixelCanvas(
  data: Uint8ClampedArray,
  width: number,
  height: number
): OffscreenCanvas | null {
  const canvas = new OffscreenCanvas(width, height);
  const cx = canvas.getContext('2d');
  if (cx === null) {
    return null;
  }
  const image = cx.createImageData(width, height);
  image.data.set(data);
  cx.putImageData(image, 0, 0);
  return canvas;
}

async function encode(canvas: OffscreenCanvas): Promise<Blob> {
  const webp = await canvas.convertToBlob({
    type: 'image/webp',
    quality: 0.86,
  });
  // A browser without a WebP encoder hands back a PNG - big with the grain.
  return webp.type === 'image/webp'
    ? webp
    : canvas.convertToBlob({ type: 'image/jpeg', quality: 0.88 });
}

function dataUrl(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}
