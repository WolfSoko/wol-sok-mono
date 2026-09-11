import { InjectionToken } from '@angular/core';

export const INITIAL_MASS_OF_SUN = 80000.0;
export const INITIAL_GRAVITY_CONSTANT = 80;
export const INITIAL_SHOW_TRAIL = true;
export const INITIAL_TRAIL_LENGTH = 150;
export const MIN_TRAIL_LENGTH = 10;
export const MAX_TRAIL_LENGTH = 600;

export interface GravityWorldConfig {
  gravitationalConstant: number;
  massOfSun: number;
  showTrail: boolean;
  trailLength: number;
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
    c1.trailLength === c2.trailLength
  );
}
