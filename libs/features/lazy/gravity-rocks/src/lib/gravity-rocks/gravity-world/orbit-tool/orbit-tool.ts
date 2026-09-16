import { computed, Signal, signal, WritableSignal } from '@angular/core';
import { vec2, Vector2d } from '@wolsok/utils-math';
import { clamp } from '../domain/clamp';
import {
  defaultOrbitDistance,
  keepsSatelliteAt,
  placementRange,
  primaryOf,
  satelliteRadiusFor,
} from '../domain/world-objects/orbit';
import { WorldObject } from '../domain/world-objects/world-object';

/** The orbit the orbit tool draws before a satellite is let go onto it. */
export interface OrbitPreview {
  center: Vector2d;
  /** Distance of the orbit from its parent, in AU. */
  radius: number;
  /** Where on the orbit the satellite is put, in radians. */
  angle: number;
  /** Where the satellite is shown, and how big. */
  satellite: Vector2d;
  satelliteRadius: number;
  /** Whether the parent keeps a satellite there, see `keepsSatelliteAt`. */
  held: boolean;
}

/** What the orbit tool has to ask the world it is drawing in. */
export interface OrbitToolWorld {
  /** The sun, which is how a body is asked what holds it. */
  sun(): WorldObject;
  /**
   * The bodies of the world. Read for its identity rather than its contents:
   * a new array means the parent may have moved, and the orbit is drawn
   * around where it is now.
   */
  bodies: Signal<readonly WorldObject[]>;
  gravitationalConstant: Signal<number>;
  /** Furthest a satellite may be placed from anything, in AU. */
  reach: Signal<number>;
}

/**
 * Putting a body in orbit around another, in two presses: the first picks the
 * body, the second draws the orbit and lets a satellite go onto it.
 *
 * Plain state and geometry - no component, no DOM, no events. The world hands
 * it pointers in world coordinates and asks what to draw; where those
 * pointers came from is somebody else's problem.
 */
export class OrbitTool {
  /** The body the orbit is drawn around, once one has been picked. */
  readonly parent: WritableSignal<WorldObject | null> = signal(null);

  /** Where the pointer drawing the orbit was last seen, in world coordinates. */
  private readonly pointer: WritableSignal<Vector2d | null> = signal(null);

  /** The pointer holding the drawn orbit, while one is pressed on it. */
  private pointerId: number | null = null;

  constructor(private readonly world: OrbitToolWorld) {}

  /**
   * The orbit drawn around the parent: as far out as the pointer, within what
   * the parent can offer, with the satellite shown where the pointer is.
   * Nothing at all until a parent is picked.
   */
  readonly preview: Signal<OrbitPreview | null> = computed(() => {
    const parent: WorldObject | null = this.parent();
    // the parent moves while the world runs, and the bodies are published
    // afresh each frame
    this.world.bodies();
    if (!parent) {
      return null;
    }
    const primary: WorldObject | undefined = primaryOf(
      parent,
      this.world.sun()
    );
    const radiusOfSatellite: number = satelliteRadiusFor(parent);
    const { min, max } = placementRange(
      parent,
      primary,
      radiusOfSatellite,
      this.world.gravitationalConstant(),
      this.world.reach()
    );
    const pointer: Vector2d | null = this.pointer();
    const towards: Vector2d | null =
      pointer && pointer.dist(parent.pos) > 0 ? pointer.sub(parent.pos) : null;
    const radius: number = clamp(
      towards
        ? towards.length()
        : defaultOrbitDistance(parent, primary, radiusOfSatellite),
      min,
      max
    );
    const angle: number = towards ? Math.atan2(towards.y, towards.x) : 0;
    return {
      center: parent.pos,
      radius,
      angle,
      satellite: parent.pos.add(
        vec2(Math.cos(angle), Math.sin(angle)).mul(radius)
      ),
      satelliteRadius: radiusOfSatellite,
      held: keepsSatelliteAt(parent, primary, radius),
    };
  });

  /** Whether a pointer is pressed on the drawn orbit right now. */
  get isHeld(): boolean {
    return this.pointerId !== null;
  }

  /** Whether this very pointer is the one holding the drawn orbit. */
  isHeldBy(pointerId: number): boolean {
    return this.pointerId === pointerId;
  }

  /** Picks the body to circle. The orbit is drawn from here on. */
  pick(parent: WorldObject): void {
    this.parent.set(parent);
    this.pointer.set(null);
  }

  /** Takes hold of the drawn orbit with a pointer pressed beside the body. */
  grab(pointerId: number, at: Vector2d): void {
    this.pointerId = pointerId;
    this.pointer.set(at);
  }

  /** Moves the drawn orbit to where the pointer is now. */
  moveTo(at: Vector2d): void {
    this.pointer.set(at);
  }

  /**
   * Lets the orbit go and says where the satellite belongs - the parent and
   * the orbit to put it on, or nothing when there was no orbit to let go of.
   *
   * A mouse keeps its pointer id from one press to the next, so letting go
   * has to forget it, or the next press would look like the same one.
   */
  release(
    at: Vector2d
  ): { parent: WorldObject; orbit: OrbitPreview } | undefined {
    this.pointerId = null;
    this.pointer.set(at);
    const parent: WorldObject | null = this.parent();
    const orbit: OrbitPreview | null = this.preview();
    return parent && orbit ? { parent, orbit } : undefined;
  }

  /** Lets go of the orbit without placing anything, the gesture was cut short. */
  letGo(): void {
    this.pointerId = null;
  }

  /** Drops what is half-drawn: no parent, no orbit, no pointer. */
  clear(): void {
    this.parent.set(null);
    this.pointer.set(null);
    this.pointerId = null;
  }

  /** Forgets a body that has left the world, if it was the one picked. */
  forget(wo: WorldObject): void {
    if (this.parent() === wo) {
      this.parent.set(null);
    }
  }
}
