import { signal, WritableSignal } from '@angular/core';
import { vec2, Vector2d } from '@wolsok/utils-math';
import { Planet } from '../domain/world-objects/planet';
import { WorldObject } from '../domain/world-objects/world-object';
import { MAX_ZOOM, MIN_ZOOM, ViewportRect, WorldCamera } from './world-camera';

/** A world six AU wide drawn into a box of 600 by 360 css pixels. */
const WORLD: Vector2d = vec2(6, 3.6);
const VIEWPORT: ViewportRect = { left: 0, top: 0, width: 600, height: 360 };

describe('WorldCamera', () => {
  let bodies: WritableSignal<readonly WorldObject[]>;
  let viewport: ViewportRect | undefined;
  let camera: WorldCamera;

  beforeEach(() => {
    bodies = signal([]);
    viewport = VIEWPORT;
    camera = new WorldCamera({
      size: signal(WORLD),
      bodies,
      viewport: () => viewport,
    });
  });

  /** The four numbers of the rendered `viewBox`. */
  function viewBox(): number[] {
    return camera.viewBox().split(' ').map(Number);
  }

  it('should show the whole world to begin with', () => {
    expect(camera.zoom()).toBe(1);
    expect(camera.center()).toEqual(vec2(3, 1.8));
    expect(viewBox()).toEqual([0, 0, 6, 3.6]);
  });

  it('should show less of the world the further it is zoomed in', () => {
    camera.zoomIn();

    const [, , width, height] = viewBox();
    expect(camera.zoom()).toBeGreaterThan(1);
    expect(width).toBeCloseTo(6 / camera.zoom(), 6);
    expect(height).toBeCloseTo(3.6 / camera.zoom(), 6);
    expect(camera.center()).toEqual(vec2(3, 1.8));
  });

  it('should never zoom past its limits', () => {
    for (let i = 0; i < 100; i++) {
      camera.zoomIn();
    }
    expect(camera.zoom()).toBe(MAX_ZOOM);
    expect(camera.canZoomIn()).toBe(false);

    for (let i = 0; i < 200; i++) {
      camera.zoomOut();
    }
    expect(camera.zoom()).toBe(MIN_ZOOM);
    expect(camera.canZoomOut()).toBe(false);
  });

  it('should show the zoom as a percentage, finer the further out it is', () => {
    expect(camera.zoomLabel()).toBe('100%');

    camera.zoomBy(0.01);

    expect(camera.zoomLabel()).toBe('1.0%');
  });

  it('should keep the world point under the cursor while zooming towards it', () => {
    // a quarter across the box, which is 1.5 AU into a world six AU wide
    const cursor = { clientX: 150, clientY: 90 };
    const before: Vector2d = camera.toWorld(cursor);

    camera.zoomAt(cursor, true);

    expect(camera.toWorld(cursor).x).toBeCloseTo(before.x, 6);
    expect(camera.toWorld(cursor).y).toBeCloseTo(before.y, 6);
  });

  it('should move the view by as much world as the pointer crossed', () => {
    camera.zoomBy(4);
    const before: Vector2d = camera.center();

    camera.startPan({ clientX: 300, clientY: 180 });
    camera.panTo({ clientX: 240, clientY: 180 });

    // a tenth of the box, of a view that is now 1.5 AU wide
    expect(camera.center().x).toBeCloseTo(before.x + 0.15, 6);
    expect(camera.center().y).toBeCloseTo(before.y, 6);
  });

  it('should not move the view before a pan has started', () => {
    const before: Vector2d = camera.center();
    camera.panTo({ clientX: 240, clientY: 180 });
    expect(camera.center()).toEqual(before);
  });

  it('should keep the view inside the world, and out to a body flung past it', () => {
    camera.startPan({ clientX: 300, clientY: 180 });
    camera.panTo({ clientX: -100000, clientY: 180 });
    expect(camera.center().x).toBe(WORLD.x);

    bodies.set([new Planet(vec2(20, 1.8), undefined, 1)]);
    camera.startPan({ clientX: 300, clientY: 180 });
    camera.panTo({ clientX: -100000, clientY: 180 });

    expect(camera.center().x).toBe(20);
  });

  it('should zoom by how far two fingers spread', () => {
    const left = { clientX: 200, clientY: 180 };
    const right = { clientX: 400, clientY: 180 };
    camera.startPinch(left, right);
    expect(camera.isPinching).toBe(true);

    camera.pinchTo(
      { clientX: 100, clientY: 180 },
      { clientX: 500, clientY: 180 }
    );

    expect(camera.zoom()).toBeCloseTo(2, 6);
  });

  it('should zoom out when two fingers come together', () => {
    camera.startPinch(
      { clientX: 100, clientY: 180 },
      { clientX: 500, clientY: 180 }
    );
    camera.pinchTo(
      { clientX: 250, clientY: 180 },
      { clientX: 350, clientY: 180 }
    );

    expect(camera.zoom()).toBeCloseTo(0.25, 6);
  });

  it('should keep the world point between the fingers between them', () => {
    const left = { clientX: 200, clientY: 120 };
    const right = { clientX: 400, clientY: 240 };
    const middle = { clientX: 300, clientY: 180 };
    const held: Vector2d = camera.toWorld(middle);

    camera.startPinch(left, right);
    camera.pinchTo(
      { clientX: 150, clientY: 140 },
      { clientX: 450, clientY: 260 }
    );

    const nowAt = { clientX: 300, clientY: 200 };
    expect(camera.toWorld(nowAt).x).toBeCloseTo(held.x, 6);
    expect(camera.toWorld(nowAt).y).toBeCloseTo(held.y, 6);
  });

  it('should forget both gestures when they end', () => {
    camera.startPan({ clientX: 300, clientY: 180 });
    camera.startPinch({ clientX: 1, clientY: 1 }, { clientX: 2, clientY: 2 });

    camera.endGesture();

    expect(camera.isPanning).toBe(false);
    expect(camera.isPinching).toBe(false);
  });

  it('should center the body it follows and let go on a second ask', () => {
    const planet = new Planet(vec2(1, 1), undefined, 1);
    bodies.set([planet]);

    camera.toggleFollow(planet);
    expect(camera.isFollowing(planet)).toBe(true);
    expect(camera.followedId()).toBe(planet.id);
    expect(camera.center()).toEqual(vec2(1, 1));

    camera.toggleFollow(planet);
    expect(camera.isFollowing(planet)).toBe(false);
    // the view stays where it was left
    expect(camera.center()).toEqual(vec2(1, 1));
  });

  it('should keep up with the body it follows as the world moves it', () => {
    const planet = new Planet(vec2(1, 1), undefined, 1);
    bodies.set([planet]);
    camera.toggleFollow(planet);

    planet.pos = vec2(2, 1.2);
    bodies.set([planet]);
    camera.keepUp();

    expect(camera.center()).toEqual(vec2(2, 1.2));
  });

  it('should let go of what it follows when the view is taken by hand', () => {
    const planet = new Planet(vec2(1, 1), undefined, 1);
    bodies.set([planet]);

    camera.toggleFollow(planet);
    camera.startPan({ clientX: 300, clientY: 180 });
    expect(camera.followedId()).toBeNull();

    camera.toggleFollow(planet);
    camera.startPinch({ clientX: 1, clientY: 1 }, { clientX: 2, clientY: 2 });
    expect(camera.followedId()).toBeNull();
  });

  it('should let go of a body that has left the world, and only that one', () => {
    const planet = new Planet(vec2(1, 1), undefined, 1);
    const other = new Planet(vec2(2, 1), undefined, 1);
    bodies.set([planet, other]);
    camera.toggleFollow(planet);

    camera.forget(other);
    expect(camera.isFollowing(planet)).toBe(true);

    camera.forget(planet);
    expect(camera.followedId()).toBeNull();
  });

  it('should show the whole world again when it is reset', () => {
    const planet = new Planet(vec2(1, 1), undefined, 1);
    bodies.set([planet]);
    camera.toggleFollow(planet);
    camera.zoomIn();

    camera.reset();

    expect(camera.zoom()).toBe(1);
    expect(camera.center()).toEqual(vec2(3, 1.8));
    expect(camera.followedId()).toBeNull();
  });

  it('should fall back to the middle of the view before the world is drawn', () => {
    viewport = undefined;

    // nothing has been measured yet, so no client position means anything
    expect(camera.toWorld({ clientX: 10, clientY: 10 })).toEqual(
      camera.center()
    );
  });
});
