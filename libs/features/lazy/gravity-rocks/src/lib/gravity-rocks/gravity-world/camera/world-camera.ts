import { computed, Signal, signal, WritableSignal } from '@angular/core';
import { vec2, Vector2d } from '@wolsok/utils-math';
import { clamp } from '../domain/clamp';
import { WorldObject } from '../domain/world-objects/world-object';

/** Furthest zoom out, shown as 0.1% - enough to watch planets fly far away. */
export const MIN_ZOOM = 0.001;
export const MAX_ZOOM = 20;
/** How far one press of a zoom button, or one notch of the wheel, takes it. */
const ZOOM_STEP = 1.3;
const WHEEL_ZOOM_STEP = 1.15;

/** Anything that carries a position in client (viewport) coordinates. */
export interface ClientPoint {
  clientX: number;
  clientY: number;
}

/** The box the world is drawn in, in client coordinates. */
export interface ViewportRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Copy of a position, so a moving pointer does not change what was stored. */
export function clientPoint({ clientX, clientY }: ClientPoint): ClientPoint {
  return { clientX, clientY };
}

/** How far two pointers are apart, in client pixels. */
export function distanceBetween(a: ClientPoint, b: ClientPoint): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

/** The point exactly between two pointers, which a pinch is anchored on. */
export function midpointOf(a: ClientPoint, b: ClientPoint): ClientPoint {
  return {
    clientX: (a.clientX + b.clientX) / 2,
    clientY: (a.clientY + b.clientY) / 2,
  };
}

/** What the camera has to ask the world it is looking at. */
export interface CameraWorld {
  /** How big the world is, in AU. */
  size: Signal<Vector2d>;
  /** The bodies in it, so the view can reach a planet flung out of the frame. */
  bodies: Signal<readonly WorldObject[]>;
  /** The box the world is drawn in, or nothing before it is rendered. */
  viewport(): ViewportRect | undefined;
}

/**
 * Where the world is looked at from: how far in it is zoomed, what sits in
 * the middle, and which body the view sticks to.
 *
 * It works in two coordinate systems and converts between them. World
 * coordinates are AU; client coordinates are the pixels a pointer arrives in.
 * The box the world is drawn in is the only thing it needs from the page, and
 * it asks the world for that rather than measuring anything itself - which is
 * what lets all of this be tested without a browser.
 */
export class WorldCamera {
  /** Zoom factor of the viewport, 1 shows the whole world. */
  private readonly zoomFactor: WritableSignal<number> = signal(1);
  /** World coordinate that sits in the middle of the viewport. */
  private readonly viewCenter: WritableSignal<Vector2d>;

  /** The body the view sticks to while the simulation runs, if any. */
  private readonly followed: WritableSignal<WorldObject | null> = signal(null);

  private panStart: { from: ClientPoint; center: Vector2d } | null = null;
  private pinchStart: {
    distance: number;
    focus: Vector2d;
    zoom: number;
  } | null = null;

  readonly zoom: Signal<number> = this.zoomFactor.asReadonly();
  readonly center: Signal<Vector2d>;

  constructor(private readonly world: CameraWorld) {
    this.viewCenter = signal(world.size().div(2));
    this.center = this.viewCenter.asReadonly();
  }

  /** Id of the followed body, for the template. */
  readonly followedId: Signal<string | null> = computed(
    () => this.followed()?.id ?? null
  );

  /** Zoom as a percentage label, with one decimal while zoomed far out. */
  readonly zoomLabel: Signal<string> = computed(() => {
    const percent: number = this.zoom() * 100;
    return percent < 10 ? `${percent.toFixed(1)}%` : `${Math.round(percent)}%`;
  });

  readonly canZoomIn: Signal<boolean> = computed(() => this.zoom() < MAX_ZOOM);
  readonly canZoomOut: Signal<boolean> = computed(() => this.zoom() > MIN_ZOOM);

  /** How much of the world fits in the viewport, in AU. */
  private readonly viewSize: Signal<Vector2d> = computed(() =>
    this.world.size().div(this.zoom())
  );

  /**
   * Area the view may be centered on: the world, grown to cover every body.
   * Bodies can be flung out of the world, and they should stay reachable.
   */
  private readonly viewBounds: Signal<{ min: Vector2d; max: Vector2d }> =
    computed(() => {
      const world: Vector2d = this.world.size();
      let min: Vector2d = vec2(0, 0);
      let max: Vector2d = world;
      for (const { pos } of this.world.bodies()) {
        min = vec2(Math.min(min.x, pos.x), Math.min(min.y, pos.y));
        max = vec2(Math.max(max.x, pos.x), Math.max(max.y, pos.y));
      }
      return { min, max };
    });

  /** The `viewBox` attribute of the svg the world is drawn in. */
  readonly viewBox: Signal<string> = computed(() => {
    const size: Vector2d = this.viewSize();
    const origin: Vector2d = this.center().sub(size.div(2));
    return (
      [origin.x, origin.y, size.x, size.y]
        // AU, so a hundredth would be a million kilometres of jitter
        .map((value) => Math.round(value * 1e6) / 1e6)
        .join(' ')
    );
  });

  /** Zooms one step in around the middle of the current view. */
  zoomIn(): void {
    this.zoomBy(ZOOM_STEP);
  }

  /** Zooms one step out around the middle of the current view. */
  zoomOut(): void {
    this.zoomBy(1 / ZOOM_STEP);
  }

  /**
   * Zooms one notch of the wheel towards `at`, so the world point under the
   * cursor stays where it is - unless a body is followed, which is zoomed
   * around instead of being lost.
   */
  zoomAt(at: ClientPoint, towardsCursor: boolean): void {
    const factor: number = towardsCursor
      ? WHEEL_ZOOM_STEP
      : 1 / WHEEL_ZOOM_STEP;
    const focus: Vector2d = this.followed() ? this.center() : this.toWorld(at);
    this.zoomBy(factor, focus);
  }

  /** Zooms by `factor`, keeping `focus` (world coordinates) on the same spot. */
  zoomBy(factor: number, focus: Vector2d = this.center()): void {
    const currentZoom: number = this.zoom();
    const nextZoom: number = clamp(currentZoom * factor, MIN_ZOOM, MAX_ZOOM);
    if (nextZoom === currentZoom) {
      return;
    }
    this.zoomFactor.set(nextZoom);
    this.viewCenter.set(
      this.withinBounds(
        focus.add(
          this.center()
            .sub(focus)
            .mul(currentZoom / nextZoom)
        )
      )
    );
  }

  /** Shows the whole world again, centered, unzoomed and following nothing. */
  reset(): void {
    this.stopFollowing();
    this.zoomFactor.set(1);
    this.viewCenter.set(this.world.size().div(2));
  }

  /** Remembers where a pan gesture started. Panning wins over following. */
  startPan(from: ClientPoint): void {
    this.stopFollowing();
    this.panStart = { from: clientPoint(from), center: this.center() };
  }

  get isPanning(): boolean {
    return this.panStart !== null;
  }

  /** Moves the view by how far the pointer has travelled since `startPan`. */
  panTo(to: ClientPoint): void {
    const panStart = this.panStart;
    const rect: ViewportRect | undefined = this.world.viewport();
    if (!panStart || !rect?.width || !rect.height) {
      return;
    }
    const size: Vector2d = this.viewSize();
    const moved: Vector2d = vec2(
      ((to.clientX - panStart.from.clientX) / rect.width) * size.x,
      ((to.clientY - panStart.from.clientY) / rect.height) * size.y
    );
    this.viewCenter.set(this.withinBounds(panStart.center.sub(moved)));
  }

  /** Remembers the spread of two fingers and the world point between them. */
  startPinch(first: ClientPoint, second: ClientPoint): void {
    // pinching is manual control, it wins over following
    this.stopFollowing();
    this.pinchStart = {
      // a pinch that starts with the fingers on one spot must not divide by 0
      distance: Math.max(distanceBetween(first, second), 1),
      focus: this.toWorld(midpointOf(first, second)),
      zoom: this.zoom(),
    };
  }

  get isPinching(): boolean {
    return this.pinchStart !== null;
  }

  /**
   * Zooms by how far the fingers have spread and pans by where they moved, so
   * the world point that started between them stays between them.
   */
  pinchTo(first: ClientPoint, second: ClientPoint): void {
    const pinchStart = this.pinchStart;
    if (!pinchStart) {
      return;
    }
    const spread: number = distanceBetween(first, second) / pinchStart.distance;
    this.zoomFactor.set(clamp(pinchStart.zoom * spread, MIN_ZOOM, MAX_ZOOM));
    this.viewCenter.set(
      this.withinBounds(
        this.centerKeeping(pinchStart.focus, midpointOf(first, second))
      )
    );
  }

  /** Ends whatever gesture is moving the view. */
  endGesture(): void {
    this.panStart = null;
    this.pinchStart = null;
  }

  /** Whether the view is stuck to this body. */
  isFollowing(wo: WorldObject): boolean {
    return this.followed() === wo;
  }

  /**
   * Follows the given body, or lets go of it when it is already followed.
   * The view stays where it is when following ends.
   */
  toggleFollow(wo: WorldObject): void {
    if (this.isFollowing(wo)) {
      this.stopFollowing();
      return;
    }
    this.followed.set(wo);
    this.centerOn(wo);
  }

  /** Lets go of the followed body, leaving the view where it is. */
  stopFollowing(): void {
    this.followed.set(null);
  }

  /** Lets go of a body that has left the world, if it was the followed one. */
  forget(wo: WorldObject): void {
    if (this.isFollowing(wo)) {
      this.stopFollowing();
    }
  }

  /** Moves the view back onto the followed body after the world has moved. */
  keepUp(): void {
    const followed: WorldObject | null = this.followed();
    if (followed) {
      this.centerOn(followed);
    }
  }

  /** Moves the view so the given body sits in the middle of it. */
  centerOn(wo: WorldObject): void {
    this.viewCenter.set(this.withinBounds(wo.pos));
  }

  /**
   * Converts a client position into world coordinates. The viewBox keeps the
   * aspect ratio of the css box, so the mapping is linear.
   */
  toWorld(at: ClientPoint): Vector2d {
    const rect: ViewportRect | undefined = this.world.viewport();
    if (!rect?.width || !rect.height) {
      return this.center();
    }
    const size: Vector2d = this.viewSize();
    const origin: Vector2d = this.center().sub(size.div(2));
    return vec2(
      origin.x + ((at.clientX - rect.left) / rect.width) * size.x,
      origin.y + ((at.clientY - rect.top) / rect.height) * size.y
    );
  }

  /** View center that puts `focus` (world coordinates) under `at`. */
  private centerKeeping(focus: Vector2d, at: ClientPoint): Vector2d {
    const rect: ViewportRect | undefined = this.world.viewport();
    if (!rect?.width || !rect.height) {
      return this.center();
    }
    const size: Vector2d = this.viewSize();
    return vec2(
      focus.x - ((at.clientX - rect.left) / rect.width - 0.5) * size.x,
      focus.y - ((at.clientY - rect.top) / rect.height - 0.5) * size.y
    );
  }

  /** Keeps the given view center within the reachable area of the world. */
  private withinBounds({ x, y }: Vector2d): Vector2d {
    const { min, max } = this.viewBounds();
    return vec2(clamp(x, min.x, max.x), clamp(y, min.y, max.y));
  }
}
