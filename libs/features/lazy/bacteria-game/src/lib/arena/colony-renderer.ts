import {
  type ColonyLayer,
  type ColonyLook,
  GameBalance,
  Rect,
} from '@wolsok/feat-shared-bacteria-engine';
import type { LookPainter } from './look-shading';
import {
  paintChrome,
  paintEclipse,
  paintGalaxy,
  paintLava,
  paintMarbles,
  paintPlasma,
  paintSlimeLook,
} from './surface-looks';
import {
  paintBubbles,
  paintCells,
  paintCrystal,
  paintHoneycomb,
  paintInk,
  paintNeon,
} from './cell-looks';
import { createCanvas } from './canvas-math';
import {
  colonyDensity,
  createImageDataFromBacterias,
  SLIME_SCALE,
  slimeRegion,
} from './slime-painter';
import { lookReach } from './lattice-cells';

export type {
  CellsLayer,
  ColonyLayer,
  StateLayer,
} from '@wolsok/feat-shared-bacteria-engine';

/** A colony as it is painted: its layer, in the look it wears. */
export type PaintedColony = ColonyLayer & { look: ColonyLook };

/** The painter of every look drawn from the density. */
const DENSITY_PAINTERS: Readonly<
  Record<Exclude<ColonyLook, 'pixels'>, LookPainter>
> = {
  slime: paintSlimeLook,
  cells: paintCells,
  honeycomb: paintHoneycomb,
  crystal: paintCrystal,
  neon: paintNeon,
  ink: paintInk,
  bubbles: paintBubbles,
  marbles: paintMarbles,
  lava: paintLava,
  galaxy: paintGalaxy,
  plasma: paintPlasma,
  chrome: paintChrome,
  eclipse: paintEclipse,
};

/** Paints a colony in a look drawn from its density - see {@link LookPainter}. */
export const paintColony = (
  look: Exclude<ColonyLook, 'pixels'>,
  ...args: Parameters<LookPainter>
): void => DENSITY_PAINTERS[look](...args);

/**
 * A layer of colonies for the canvas, ready to be drawn over the floor:
 * the looks drawn from the density at {@link SLIME_SCALE} pixels per
 * cell, scaled up smoothly, or the crisp pixels, one per cell.
 */
export interface ColonyImage {
  canvas: HTMLCanvasElement;
  /** True for the layer drawn from the density - scale it up smoothly. */
  smooth: boolean;
}

/** An offscreen layer of the arena, made the first time it is drawn on. */
class ColonyBuffer {
  private layer: {
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D;
    image: ImageData;
  } | null = null;
  /** True once a frame drew on the layer since it was last committed. */
  private drawn = false;

  public constructor(
    private readonly width: number,
    private readonly height: number,
    /** Pixels per arena cell. */
    private readonly scale: number,
    /** Scale the layer up smoothly - see {@link ColonyImage}. */
    private readonly smooth: boolean
  ) {}

  /** The layer's pixels, cleared for a frame - null where there is no canvas. */
  public clear(): Uint8ClampedArray | null {
    this.layer ??= this.prepare();
    if (this.layer == null) {
      return null;
    }
    this.layer.image.data.fill(0);
    this.drawn = true;
    return this.layer.image.data;
  }

  /** The layer with what was drawn since {@link clear} - null without. */
  public commit(): ColonyImage | null {
    if (this.layer == null || !this.drawn) {
      return null;
    }
    this.drawn = false;
    this.layer.context.putImageData(this.layer.image, 0, 0);
    return { canvas: this.layer.canvas, smooth: this.smooth };
  }

  private prepare(): ColonyBuffer['layer'] {
    const canvas = createCanvas(
      this.width * this.scale,
      this.height * this.scale
    );
    const context = canvas?.getContext?.('2d') ?? null;
    if (canvas == null || context == null) {
      return null;
    }
    const image = context.createImageData(canvas.width, canvas.height);
    return { canvas, context, image };
  }
}

/**
 * Draws the colonies into offscreen layers and hands them back, ready to
 * be drawn over the floor: one pixel per bacterium for the pixel look, and
 * every other look from the colony's density - smooth slime, cells, tiles,
 * neon or ink. Each colony is drawn in its own look, the pixel colonies on
 * one layer and the density looks on another. The buffers are kept between
 * frames.
 */
export class ColonyRenderer {
  private readonly crisp: ColonyBuffer;
  private readonly smooth: ColonyBuffer;
  private readonly density: Float32Array;
  private readonly heat: Float32Array;
  private readonly scratch: Float32Array;

  public constructor(
    private readonly width: number,
    private readonly height: number,
    /** Cells per base cell - the boost's waves are as wide on every grid. */
    private readonly unit: number
  ) {
    const cells = width * height;
    this.crisp = new ColonyBuffer(width, height, 1, false);
    this.smooth = new ColonyBuffer(width, height, SLIME_SCALE, true);
    this.density = new Float32Array(cells);
    this.heat = new Float32Array(cells);
    this.scratch = new Float32Array(cells);
  }

  /**
   * The layers with every colony on them, in the order to draw them - the
   * crisp pixels under the density looks, whose halos reach out over them.
   * Empty where there is no canvas. The slime is only worked out for what
   * the canvas shows of the arena, `view`.
   */
  public render(
    colonies: readonly PaintedColony[],
    balance: GameBalance,
    timeSec: number,
    view: Rect
  ): ColonyImage[] {
    let crisp: Uint8ClampedArray | null = null;
    let smooth: Uint8ClampedArray | null = null;
    for (const colony of colonies) {
      if (colony.kind !== 'cells') {
        continue;
      }
      const { look } = colony;
      const shimmer =
        colony.boostTarget == null
          ? null
          : { timeSec, target: colony.boostTarget, unit: this.unit };
      if (look === 'pixels') {
        crisp ??= this.crisp.clear();
        if (crisp != null) {
          createImageDataFromBacterias(
            crisp,
            this.width,
            colony.color,
            colony.cells,
            balance,
            shimmer
          );
        }
        continue;
      }
      smooth ??= this.smooth.clear();
      if (smooth == null) {
        continue;
      }
      const { width, height, unit } = this;
      const region = slimeRegion(colony.cells, view, width, height);
      if (region == null) {
        continue;
      }
      // A look that reaches past the view reads the density there, but
      // paints only what the view can show.
      const reach = lookReach(look, unit);
      const wide =
        reach > 0
          ? (slimeRegion(colony.cells, view, width, height, reach) ?? region)
          : region;
      const hot = colonyDensity(
        this.density,
        this.heat,
        this.scratch,
        width,
        height,
        colony.cells,
        balance,
        wide
      );
      paintColony(
        look,
        smooth,
        this.density,
        hot ? this.heat : null,
        width,
        height,
        colony.color,
        shimmer,
        unit,
        region,
        wide,
        timeSec
      );
    }
    return [this.crisp, this.smooth].flatMap((buffer) => buffer.commit() ?? []);
  }
}
