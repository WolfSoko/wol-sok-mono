import {
  ApplicationConfig,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideWsThanosOptions } from '@wolsok/thanos';

/** open the app with ?demo to see the full effect, the e2e tests use the fast setup */
const isDemo = new URLSearchParams(window.location.search).has('demo');

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideWsThanosOptions(
      isDemo
        ? { animationLength: 10_000 }
        : {
            maxParticleCount: 500,
            animationLength: 1000,
            particleAcceleration: 1000,
          }
    ),
  ],
};
