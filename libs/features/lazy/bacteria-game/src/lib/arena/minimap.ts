import { BlockCounts } from '../state/simulation';
import { DynamicWall, Rect } from '../state/maps';
import { ArenaTheme, cssTriple, Rgb } from './arena-theme';

/** How faint a block with a single bacterium is - a full one is opaque. */
const MIN_ALPHA = 0.35;

/**
 * One pixel per block: the colour of the colony with the most bacteria in
 * it, the fuller the block the more opaque - an empty block stays clear.
 * `colors` are RGB, by colony, in the order of the counts.
 */
export function minimapPixels(
  blocks: BlockCounts,
  colors: readonly (readonly number[])[],
  out: Uint8ClampedArray = new Uint8ClampedArray(
    blocks.blocksX * blocks.blocksY * 4
  )
): Uint8ClampedArray {
  const { counts, cellSize } = blocks;
  const full = cellSize * cellSize;
  for (let block = 0; block < blocks.blocksX * blocks.blocksY; block++) {
    let most = 0;
    let owner = -1;
    for (let colony = 0; colony < counts.length; colony++) {
      if (counts[colony][block] > most) {
        most = counts[colony][block];
        owner = colony;
      }
    }
    const at = block * 4;
    if (owner < 0) {
      out[at + 3] = 0;
      continue;
    }
    const color = colors[owner];
    out[at] = color[0];
    out[at + 1] = color[1];
    out[at + 2] = color[2];
    out[at + 3] =
      255 * Math.min(1, MIN_ALPHA + (1 - MIN_ALPHA) * (most / full));
  }
  return out;
}

/**
 * The whole arena in a corner of the screen while the camera shows part of
 * a big map: the walls, the colonies block by block, and a frame around
 * what the camera shows. It draws on its own small canvas with Canvas 2D,
 * whichever painter draws the arena - the blocks come from either
 * simulation, the GPU one reads them back with its report anyway.
 */
export class MinimapPainter {
  /** The floor and the walls, which never move - laid once per map. */
  private readonly base: HTMLCanvasElement;
  /** The colonies, one pixel per block. */
  private readonly blocks: HTMLCanvasElement;
  private pixels: ImageData | null = null;
  /** Arena cells per block. */
  private cellSize = 1;
  private theme: ArenaTheme | null = null;
  /** Minimap pixels per arena cell. */
  private readonly scale: number;

  public constructor(
    private readonly cx: CanvasRenderingContext2D,
    arenaWidth: number,
    arenaHeight: number
  ) {
    const canvas = cx.canvas;
    this.scale = canvas.width / arenaWidth;
    canvas.height = Math.round(arenaHeight * this.scale);
    this.base = document.createElement('canvas');
    this.base.width = canvas.width;
    this.base.height = canvas.height;
    this.blocks = document.createElement('canvas');
  }

  /** Lays another map: its floor colour and its walls. */
  public setMap(theme: ArenaTheme, walls: readonly Rect[]): void {
    this.theme = theme;
    const cx = this.base.getContext('2d');
    if (cx == null) {
      return;
    }
    cx.fillStyle = rgb(theme.floor);
    cx.fillRect(0, 0, this.base.width, this.base.height);
    cx.fillStyle = rgb(theme.wallEdge);
    for (const wall of walls) {
      this.fillWall(cx, wall);
    }
  }

  /** Takes in where the colonies are now - their RGB colours by colony. */
  public update(
    counts: BlockCounts,
    colors: readonly (readonly number[])[]
  ): void {
    const { blocksX, blocksY } = counts;
    if (this.pixels?.width !== blocksX || this.pixels.height !== blocksY) {
      this.pixels = new ImageData(blocksX, blocksY);
      this.blocks.width = blocksX;
      this.blocks.height = blocksY;
    }
    this.cellSize = counts.cellSize;
    minimapPixels(counts, colors, this.pixels.data);
    this.blocks.getContext('2d')?.putImageData(this.pixels, 0, 0);
  }

  /** Draws the minimap, with a frame around the camera's `view`. */
  public paint(view: Rect, dynamicWalls: readonly DynamicWall[]): void {
    const cx = this.cx;
    const { width, height } = cx.canvas;
    cx.clearRect(0, 0, width, height);
    cx.drawImage(this.base, 0, 0);
    if (this.pixels != null) {
      // Blocks of cells scaled up smoothly read as blobs, like the colonies.
      cx.imageSmoothingEnabled = true;
      // The last blocks may reach past the edge of the arena.
      const blockSize = this.cellSize * this.scale;
      cx.drawImage(
        this.blocks,
        0,
        0,
        this.pixels.width * blockSize,
        this.pixels.height * blockSize
      );
    }
    if (this.theme != null) {
      cx.fillStyle = rgb(this.theme.border);
      for (const wall of dynamicWalls) {
        if (wall.solid) {
          this.fillWall(cx, wall);
        }
      }
    }
    cx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    cx.lineWidth = 1.5;
    cx.strokeRect(
      view.x * this.scale + 0.75,
      view.y * this.scale + 0.75,
      view.width * this.scale - 1.5,
      view.height * this.scale - 1.5
    );
  }

  private fillWall(cx: CanvasRenderingContext2D, wall: Rect): void {
    const s = this.scale;
    if (wall.round) {
      cx.beginPath();
      cx.ellipse(
        (wall.x + wall.width / 2) * s,
        (wall.y + wall.height / 2) * s,
        (wall.width / 2) * s,
        (wall.height / 2) * s,
        0,
        0,
        Math.PI * 2
      );
      cx.fill();
    } else {
      cx.fillRect(wall.x * s, wall.y * s, wall.width * s, wall.height * s);
    }
  }
}

function rgb(color: Rgb): string {
  return `rgb(${cssTriple(color)})`;
}
