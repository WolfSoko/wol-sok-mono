import { WsThanosOptions } from './ws-thanos.options';

export function createWsThanosOptions(
  options?: Partial<WsThanosOptions>
): WsThanosOptions {
  return {
    animationLength: 5000,
    maxParticleCount: 3_000_000,
    particleAcceleration: 30,
    sound: true,
    soundVolume: 0.5,
    crumble: 'shards',
    ...options,
  };
}
