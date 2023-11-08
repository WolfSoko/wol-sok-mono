import { InjectionToken } from '@angular/core';

export const INITIAL_MASS_OF_SUN = 80000.0;
export const INITIAL_GRAVITY_CONSTANT = 80;

export interface GravityWorldConfig {
  gravitationalConstant: number;
  massOfSun: number;
}

export const INITIAL_CONFIG: InjectionToken<GravityWorldConfig> = new InjectionToken<GravityWorldConfig>(
  'Default config values for gravity world',
  {
    factory: () => ({
      gravitationalConstant: INITIAL_GRAVITY_CONSTANT,
      massOfSun: INITIAL_MASS_OF_SUN,
    }),
    providedIn: 'root',
  }
);

export function compareGravityWorldConfig(c1: GravityWorldConfig, c2: GravityWorldConfig): boolean {
  return c1.massOfSun === c2.massOfSun && c1.gravitationalConstant === c2.gravitationalConstant;
}
