import {
  ApplicationConfig,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideWsThanosOptions } from '@wolsok/thanos';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideWsThanosOptions({
      maxParticleCount: 500,
      animationLength: 1000,
      particleAcceleration: 1000,
    }),
  ],
};
