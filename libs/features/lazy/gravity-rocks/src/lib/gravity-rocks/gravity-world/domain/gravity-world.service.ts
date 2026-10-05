import {
  computed,
  Injectable,
  Signal,
  signal,
  WritableSignal,
} from '@angular/core';
import { GRAVITATIONAL_CONSTANT } from './solar-system';
import { Force } from './world-objects/force';
import { Planet } from './world-objects/planet';
import { WorldObject } from './world-objects/world-object';

/**
 * Longest slice of world time the integrator can follow in one go, in years.
 * A third of a day, so mercury's 88-day year is two hundred and forty of them:
 * even the fastest planet is carried through its orbit in hundreds of steps
 * rather than tens, and its ellipse stays put instead of creeping.
 */
export const MAX_TICK_YEARS = 0.001;
/**
 * Slices one frame may be cut into, so speed cannot stall the browser. Enough
 * that the fastest simulation still runs at its full speed while frames take
 * up to a twentieth of a second, which is as slow as a screen gets before
 * nothing looks right anyway.
 */
export const MAX_TICKS_PER_FRAME = 60;

/**
 * The world: every body in it, whatever pulls on them besides each other, and
 * the clock that moves them all.
 *
 * Deliberately not `providedIn: 'root'`. A world belongs to the component
 * showing it - one kept alive past the route would greet the next visit with
 * the planets of the last one still in it, on top of a fresh solar system.
 *
 * The bodies are mutable objects, not signals: a tick writes to every one of
 * them, and a thousand signal writes a frame would buy nothing. Instead the
 * world says once, after a frame, that its contents have moved on.
 */
@Injectable()
export class GravityWorldService {
  private objects: WorldObject[] = [];
  private forceSet: Set<Force> = new Set();
  private gravitationalConstant: number = GRAVITATIONAL_CONSTANT;

  private readonly publishedObjects: WritableSignal<readonly WorldObject[]> =
    signal([]);
  private readonly publishedForces: WritableSignal<readonly Force[]> = signal(
    []
  );

  /** Every body in the world, renewed whenever any of them has changed. */
  readonly worldObjects: Signal<readonly WorldObject[]> =
    this.publishedObjects.asReadonly();

  /** What pulls on the bodies besides their own gravity. */
  readonly forces: Signal<readonly Force[]> = this.publishedForces.asReadonly();

  /** The bodies that move: everything in the world except the sun. */
  readonly planets: Signal<Planet[]> = computed(() =>
    this.worldObjects().filter((wo): wo is Planet => wo instanceof Planet)
  );

  /** The gravity the world runs on, in AU³ / (M☉ · year²). */
  setGravitationalConstant(gravitationalConstant: number): void {
    this.gravitationalConstant = gravitationalConstant;
  }

  addWorldObject(wo: WorldObject): void {
    this.objects.push(wo);
    this.publish();
  }

  removeWorldObject(woToRemove: WorldObject): void {
    this.objects = this.objects.filter((wo) => wo !== woToRemove);
    this.publish();
  }

  addForceObject(forceObj: Force): void {
    this.forceSet.add(forceObj);
    this.publish();
  }

  removeForceObject(forceObj: Force): boolean {
    const removed: boolean = this.forceSet.delete(forceObj);
    this.publish();
    return removed;
  }

  /** Empties the world: no bodies, no forces. */
  removeAll(): void {
    this.objects = [];
    this.forceSet.clear();
    this.publish();
  }

  /**
   * Says that bodies were changed in place - a mass set, a planet moved onto
   * another orbit. The objects themselves carry no signals, so this is how
   * everything drawing them hears about it.
   */
  refresh(): void {
    this.publish();
  }

  /**
   * Moves the world on by `years` of world time, cut into slices the
   * integrator can still follow: at ten times speed one slice would be ten
   * frames wide and the orbits would fly apart.
   *
   * A trail point is recorded per slice while `trailLength` asks for one, or
   * a fast world draws a polygon; a `trailLength` of zero clears what is
   * there, once, rather than once per slice.
   *
   * Everything reading the world is told once, at the end: a frame is a
   * single change, however many slices it took.
   */
  advance(years: number, trailLength = 0): void {
    const ticks: number = Math.min(
      Math.max(Math.ceil(years / MAX_TICK_YEARS), 1),
      MAX_TICKS_PER_FRAME
    );
    for (let tick = 0; tick < ticks; tick++) {
      this.calcNextTick(years / ticks);
      if (trailLength > 0) {
        this.recordTrails(trailLength);
      }
    }
    if (trailLength <= 0) {
      this.recordTrails(0);
    }
    this.publish();
  }

  /**
   * Moves the world on by `dT` of world time: every pair of objects pulls on
   * each other, then every object is moved once by the sum of what pulled on
   * it. Gathering first and moving after is what keeps an orbit the same
   * whether the world holds two bodies or twenty.
   *
   * One slice of physics and nothing else - it is `advance` that tells the
   * world about it once the frame is done.
   */
  calcNextTick(dT: number): void {
    // apply gravity between all objects
    for (let i = 0; i < this.objects.length; i++) {
      const current = this.objects[i];
      for (let j = i + 1; j < this.objects.length; j++) {
        const other = this.objects[j];
        const distance = current.distanceTo(other);
        const forceMagnitude =
          (-this.gravitationalConstant * current.mass * other.mass) /
          distance ** 2;
        const forceDirection = current.directionTo(other);
        const directedForce = forceDirection.mul(forceMagnitude);

        current.addForce(directedForce);
        other.addForce(directedForce.mul(-1));
      }
      for (const force of this.forceSet) {
        force.applyForceFor(current);
      }
    }
    for (const wo of this.objects) {
      wo.integrate(dT);
    }
  }

  /**
   * Appends the current position of every moving object to its trail.
   * Pass a `maxTrailPoints` of zero or less to switch trails off and clear them.
   */
  recordTrails(maxTrailPoints: number): void {
    for (const wo of this.objects) {
      if (wo.isStatic) {
        continue;
      }
      wo.recordTrail(maxTrailPoints);
    }
  }

  private publish(): void {
    this.publishedObjects.set([...this.objects]);
    this.publishedForces.set([...this.forceSet]);
  }
}
