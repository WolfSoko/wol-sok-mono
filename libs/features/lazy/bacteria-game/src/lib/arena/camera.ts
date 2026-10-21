import { clamp, Point } from '../state/geometry';
import { Rect } from '../state/maps';
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
 * Pure numbers, no DOM: the painters draw {@link viewRect} of the arena
 * onto a canvas as big as for a base map.
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
   * The part of the arena in view, in cells: the camera's point in the
   * middle, unless that would show beyond an edge of the arena.
   */
  public viewRect(): Rect {
    const { x, y, zoom } = this.current;
    const width = this.width / zoom;
    const height = this.height / zoom;
    return {
      x: clamp(x - width / 2, 0, this.width - width),
      y: clamp(y - height / 2, 0, this.height - height),
      width,
      height,
    };
  }

  private whole(): CameraView {
    return { x: this.width / 2, y: this.height / 2, zoom: 1 };
  }
}
