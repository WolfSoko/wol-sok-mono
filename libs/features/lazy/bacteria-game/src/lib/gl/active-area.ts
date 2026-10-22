import { CellBounds } from '../state/geometry';
import { Rect } from '../state/maps';

/**
 * Above this share of the arena, one pass over all of it is about as cheap
 * as a draw per box.
 */
const WHOLE_SHARE = 0.9;

/**
 * Where a tick's cell passes have to run: around each colony, its box grown
 * by `margin` cells - as far as its bacteria may have got since the box was
 * measured - along with the rects in `keep` as they are. Everywhere else
 * the arena is empty, and a pass would only write empty cells over empty
 * ones.
 *
 * Two boxes that overlap are merged when the box around both is no bigger
 * than the two together. Otherwise both are kept: a pass drawn twice over
 * a cell reads the same state and writes the same result again - wasted,
 * but less than the corners a merged box would add. Returns the whole
 * arena, a single rect, once the boxes cover most of it.
 */
export function activeRects(
  bounds: readonly (CellBounds | null)[],
  margin: number,
  width: number,
  height: number,
  keep: readonly Rect[] = []
): Rect[] {
  const grownBounds = bounds
    .filter((box): box is CellBounds => box != null)
    .map((box) => ({
      minX: Math.max(0, box.minX - margin),
      minY: Math.max(0, box.minY - margin),
      maxX: Math.min(width - 1, box.maxX + margin),
      maxY: Math.min(height - 1, box.maxY + margin),
    }));
  const kept = keep.map((rect) => ({
    minX: rect.x,
    minY: rect.y,
    maxX: rect.x + rect.width - 1,
    maxY: rect.y + rect.height - 1,
  }));
  const boxes: CellBounds[] = [];
  for (const box of [...grownBounds, ...kept]) {
    let grown = box;
    // Swallow every box it pays to - and again, as the union grows.
    for (let index = 0; index < boxes.length;) {
      if (worthMerging(grown, boxes[index])) {
        grown = union(grown, boxes[index]);
        boxes.splice(index, 1);
        index = 0;
      } else {
        index++;
      }
    }
    boxes.push(grown);
  }
  const rects = boxes.map((box) => ({
    x: box.minX,
    y: box.minY,
    width: box.maxX - box.minX + 1,
    height: box.maxY - box.minY + 1,
  }));
  const area = rects.reduce((sum, rect) => sum + rect.width * rect.height, 0);
  return area > WHOLE_SHARE * width * height
    ? [{ x: 0, y: 0, width, height }]
    : rects;
}

/** True when one box around both costs no more cells than the two apart. */
function worthMerging(a: CellBounds, b: CellBounds): boolean {
  return area(union(a, b)) <= area(a) + area(b);
}

function area(box: CellBounds): number {
  return (box.maxX - box.minX + 1) * (box.maxY - box.minY + 1);
}

function union(a: CellBounds, b: CellBounds): CellBounds {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}
