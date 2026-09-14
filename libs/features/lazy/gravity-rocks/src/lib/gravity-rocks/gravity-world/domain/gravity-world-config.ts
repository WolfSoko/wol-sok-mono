import { InjectionToken } from '@angular/core';
import { GRAVITATIONAL_CONSTANT } from './solar-system';

/** One solar mass: the world measures mass in them, so the sun weighs 1. */
export const INITIAL_MASS_OF_SUN = 1;
/** The real one, in the units of the world - see `solar-system.ts`. */
export const INITIAL_GRAVITY_CONSTANT = GRAVITATIONAL_CONSTANT;
export const INITIAL_SHOW_TRAIL = true;
export const INITIAL_TRAIL_LENGTH = 150;
export const MIN_TRAIL_LENGTH = 10;
export const MAX_TRAIL_LENGTH = 600;
/** How much world time a second of real time is worth. */
export const INITIAL_SIMULATION_SPEED = 1;
export const MIN_SIMULATION_SPEED = 0.1;
export const MAX_SIMULATION_SPEED = 10;

export interface GravityWorldConfig {
  gravitationalConstant: number;
  massOfSun: number;
  showTrail: boolean;
  trailLength: number;
  simulationSpeed: number;
}

export const INITIAL_CONFIG: InjectionToken<GravityWorldConfig> =
  new InjectionToken<GravityWorldConfig>(
    'Default config values for gravity world',
    {
      factory: () => ({
        gravitationalConstant: INITIAL_GRAVITY_CONSTANT,
        massOfSun: INITIAL_MASS_OF_SUN,
        showTrail: INITIAL_SHOW_TRAIL,
        trailLength: INITIAL_TRAIL_LENGTH,
        simulationSpeed: INITIAL_SIMULATION_SPEED,
      }),
      providedIn: 'root',
    }
  );

export function compareGravityWorldConfig(
  c1: GravityWorldConfig,
  c2: GravityWorldConfig
): boolean {
  return (
    c1.massOfSun === c2.massOfSun &&
    c1.gravitationalConstant === c2.gravitationalConstant &&
    c1.showTrail === c2.showTrail &&
    c1.trailLength === c2.trailLength &&
    c1.simulationSpeed === c2.simulationSpeed
  );
}
