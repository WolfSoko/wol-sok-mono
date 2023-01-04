import { WsThanosOptions } from './ws-thanos.options';

export function createWsThanosOptions(options?: Partial<WsThanosOptions>): WsThanosOptions {
  return {
    animationLength: 5000,
    maxParticleCount: 400000,
    particleAcceleration: 30,
    ...options,
  };
}
