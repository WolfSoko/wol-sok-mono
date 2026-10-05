import { createWsThanosOptions } from './create-ws-thanos-options';

describe('createWsThanosOptions', () => {
  it('should enable the snap sound by default', () => {
    expect(createWsThanosOptions().sound).toBe(true);
  });

  it('should use half volume by default', () => {
    expect(createWsThanosOptions().soundVolume).toBe(0.5);
  });

  it('should allow ~1.5M particles by default for the GPU renderer', () => {
    expect(createWsThanosOptions().maxParticleCount).toBe(1_500_000);
  });

  it('should let callers disable the sound', () => {
    expect(createWsThanosOptions({ sound: false }).sound).toBe(false);
  });
});
