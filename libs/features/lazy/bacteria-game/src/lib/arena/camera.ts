import type { WeaponFire, WeaponId } from '../state/evolution';
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

/**
 * How hard each weapon shakes the screen as it goes off, 0 to 1 - the
 * phage strike hardest.
 */
export const WEAPON_SHAKE: Readonly<Record<WeaponId, number>> = {
  'toxin-bomb': 0.45,
  'cryo-pulse': 0.4,
  'phage-strike': 0.9,
  'agar-bloom': 0.25,
  'biofilm-shield': 0.3,
};

/** How much of a shake dies down per second. */
const SHAKE_DECAY_PER_SEC = 2.4;
/** The farthest a full shake moves the view, as a share of its width. */
const SHAKE_REACH = 0.012;
/** The computer's weapons shake the screen this much less. */
const BOT_SHAKE = 0.5;

/**
 * A short shake of the view as a weapon goes off: the view punches in a
 * little and jitters, dying down within half a second. The shake grows
 * with the square of its strength, so a light one is barely felt, and it
 * never shows anything beyond the arena.
 *
 * Pure numbers, like the camera - and for the eye only: nothing of it
 * reaches the war.
 */
export class CameraShake {
  /** How strong the shake is now, 0 to 1. */
  private trauma = 0;
  private timeSec = 0;

  public get strength(): number {
    return this.trauma;
  }

  /**
   * Shakes for the weapons fired - the computer's softer. Players who asked
   * for less motion get no shake at all.
   */
  public fire(fires: readonly WeaponFire[], reducedMotion: boolean): void {
    if (reducedMotion) {
      this.trauma = 0;
      return;
    }
    for (const fire of fires) {
      const kick = WEAPON_SHAKE[fire.weapon] * (fire.isBot ? BOT_SHAKE : 1);
      this.trauma = Math.min(1, this.trauma + kick);
    }
  }

  /** Lets the shake die down by a frame. */
  public advance(deltaSec: number): void {
    const step = Math.max(0, deltaSec);
    this.timeSec += step;
    this.trauma = Math.max(0, this.trauma - SHAKE_DECAY_PER_SEC * step);
  }

  /** Stills the view at once - another match starts. */
  public reset(): void {
    this.trauma = 0;
  }

  /**
   * The view shaken: zoomed in a little and pushed off its centre, inside
   * an arena that size. The view itself while nothing shakes.
   */
  public shake(view: Rect, arenaWidth: number, arenaHeight: number): Rect {
    if (this.trauma <= 0) {
      return view;
    }
    const amount = this.trauma * this.trauma;
    const reach = view.width * SHAKE_REACH * amount;
    const t = this.timeSec;
    // A few sines out of step read as a random jitter, without a random.
    const dx = reach * (0.6 * Math.sin(t * 71) + 0.4 * Math.sin(t * 113 + 1.3));
    const dy = reach * (0.6 * Math.sin(t * 83 + 2.1) + 0.4 * Math.sin(t * 127));
    const scale = 1 - 2 * SHAKE_REACH * amount;
    const width = view.width * scale;
    const height = view.height * scale;
    return {
      x: clamp(view.x + (view.width - width) / 2 + dx, 0, arenaWidth - width),
      y: clamp(
        view.y + (view.height - height) / 2 + dy,
        0,
        arenaHeight - height
      ),
      width,
      height,
    };
  }
}
