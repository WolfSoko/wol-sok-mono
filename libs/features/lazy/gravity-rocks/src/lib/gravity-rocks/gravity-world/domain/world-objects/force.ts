import { WorldObject } from './world-object';
import { SvgPath } from './svg-paths';

/**
 * Something that pulls on a world object besides gravity. The world applies
 * every force it holds to every object once per tick, and each force decides
 * for itself which objects it acts on.
 */
export abstract class Force {
  constructor(public id: string) {}

  abstract applyForceFor(wo: WorldObject): void;

  /**
   * The line this force is drawn as, or `null` for one that is not shown.
   * A force knows its own shape, so nothing else has to ask what it is.
   */
  svgPath(): SvgPath | null {
    return null;
  }
}
