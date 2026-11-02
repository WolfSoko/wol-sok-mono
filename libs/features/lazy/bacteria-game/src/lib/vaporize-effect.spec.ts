import {
  isVaporizeMs,
  isVaporizeQuality,
  vaporizePixels,
} from './vaporize-effect';

describe('the vaporize settings', () => {
  it('captures fewer pixels at low quality than at medium', () => {
    expect(vaporizePixels('low')).toBeLessThan(vaporizePixels('medium') ?? 0);
  });

  it('leaves full quality and an effect switched off without a budget', () => {
    expect(vaporizePixels('full')).toBeUndefined();
    expect(vaporizePixels('off')).toBeUndefined();
  });

  it('knows its qualities and durations', () => {
    expect(isVaporizeQuality('off')).toBe(true);
    expect(isVaporizeQuality('ultra')).toBe(false);
    expect(isVaporizeMs(2500)).toBe(true);
    expect(isVaporizeMs(1234)).toBe(false);
  });
});
