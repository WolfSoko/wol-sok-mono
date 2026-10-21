import { clamp, Point } from '../state/geometry';
import { lerp } from './canvas-math';

/** How quickly the camera catches up, per second - higher is snappier. */
const FOLLOW_RATE = 4;

/**
 * What the camera shows of a map bigger than the base arena: the point of
 * the arena in the middle of the view, in cells, and the zoom - 1 shows the
 * whole arena, `maxZoom` a part of it as big as a base map is drawn.
 */
export interface CameraView {
  x: number;
  y: number;
  zoom: number;
}

/**
 * The camera over a big map. It follows a point - the player's crosshair -
 * on a soft spring, zooms between the whole arena and the size of a base
 * map, and never shows anything outside the arena.
 *
 * Pure numbers, no DOM: the component turns {@link transform} into a CSS
 * transform of the canvas, which the painters draw whole.
 */
export class Camera {
  private current: CameraView;
  /** The zoom the player picked - the camera eases towards it. */
  private wanted: number;

  public constructor(
    private readonly width: number,
    private readonly height: number,
    /** The zoom at which a cell is as big as on a base map. */
    public readonly maxZoom: number
  ) {
    this.current = this.whole();
    this.wanted = maxZoom;
  }

  public get view(): CameraView {
    return this.current;
  }

  /** Shows the whole arena at once - where every match starts. */
  public reset(): void {
    this.current = this.whole();
  }

  /** Zooms in (above 1) or out (below 1) by that factor. */
  public zoomBy(factor: number): void {
    this.wanted = clamp(this.wanted * factor, 1, this.maxZoom);
  }

  /**
   * Moves the camera `deltaSec` closer to `target` at the zoom picked -
   * or, without a target, to the whole arena.
   */
  public follow(target: Point | null, deltaSec: number): void {
    const goal: CameraView =
      target == null
        ? this.whole()
        : { x: target.x, y: target.y, zoom: this.wanted };
    const k = 1 - Math.exp(-FOLLOW_RATE * Math.max(0, deltaSec));
    this.current = {
      x: lerp(this.current.x, goal.x, k),
      y: lerp(this.current.y, goal.y, k),
      zoom: lerp(this.current.zoom, goal.zoom, k),
    };
  }

  /** True once the camera is where it is heading - nothing left to ease. */
  public settledOn(target: Point | null): boolean {
    const goal = target ?? this.whole();
    const zoom = target == null ? 1 : this.wanted;
    return (
      Math.abs(this.current.x - goal.x) < 0.5 &&
      Math.abs(this.current.y - goal.y) < 0.5 &&
      Math.abs(this.current.zoom - zoom) < 0.005
    );
  }

  /**
   * The view as a scale and a shift of the canvas, the shift in percent of
   * its size - `translate(x%, y%) scale(scale)` from its top left corner
   * puts the camera's point in the middle, the arena's edge no further in
   * than the view's.
   */
  public transform(): { x: number; y: number; scale: number } {
    const { zoom } = this.current;
    const shift = (at: number, size: number) =>
      clamp(50 - (zoom * at * 100) / size, 100 - zoom * 100, 0);
    return {
      x: shift(this.current.x, this.width),
      y: shift(this.current.y, this.height),
      scale: zoom,
    };
  }

  private whole(): CameraView {
    return { x: this.width / 2, y: this.height / 2, zoom: 1 };
  }
}
