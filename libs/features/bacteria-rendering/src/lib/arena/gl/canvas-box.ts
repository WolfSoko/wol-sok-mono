import type { Rect } from '@wolsok/feat-shared-bacteria-engine';

/** A box of arena cells, `[x0, y0, x1, y1]` - x1 and y1 just past it. */
export type CellBox = readonly [number, number, number, number];

/** Whole pixels of a render target, row 0 at its bottom - right and top just past it. */
export interface PixelBox {
  readonly left: number;
  readonly bottom: number;
  readonly right: number;
  readonly top: number;
}

/**
 * The pixels of a render target that show a box of cells, the target
 * showing `view` of the arena upside down (row 0 is the view's bottom).
 * Rounded out to whole pixels - at a scale like 7.5 a cell edge falls
 * inside one - and cut to the target, so a box out of view comes out
 * empty.
 */
export function canvasBox(
  box: CellBox,
  view: Rect,
  width: number,
  height: number
): PixelBox {
  const [x0, y0, x1, y1] = box;
  const scale = width / view.width;
  const clampX = (x: number) => Math.min(Math.max(x, 0), width);
  const clampY = (y: number) => Math.min(Math.max(y, 0), height);
  return {
    left: clampX(Math.floor((x0 - view.x) * scale)),
    right: clampX(Math.ceil((x1 - view.x) * scale)),
    bottom: clampY(Math.floor(height - (y1 - view.y) * scale)),
    top: clampY(Math.ceil(height - (y0 - view.y) * scale)),
  };
}

/** True when the box holds no pixel. */
export function isEmptyBox(box: PixelBox): boolean {
  return box.right <= box.left || box.top <= box.bottom;
}

/**
 * A box of a target's pixels in clip space, `[x0, y0, x1, y1]` from -1
 * to 1 - what a quad drawn with `BOX_VERTEX` covers, pixel edge on pixel
 * edge, so it rasterises exactly the pixels of the box.
 */
export function clipBox(
  box: PixelBox,
  width: number,
  height: number
): [number, number, number, number] {
  return [
    (box.left / width) * 2 - 1,
    (box.bottom / height) * 2 - 1,
    (box.right / width) * 2 - 1,
    (box.top / height) * 2 - 1,
  ];
}
