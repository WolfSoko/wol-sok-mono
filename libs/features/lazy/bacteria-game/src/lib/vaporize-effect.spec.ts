import {
  isVaporizeMs,
  isVaporizeQuality,
  vaporizePixelRatio,
} from './vaporize-effect';

describe('vaporizePixelRatio', () => {
  it('captures a big desktop arena with fewer pixels than CSS pixels', () => {
    const box = { width: 1600, height: 900 };

    const ratio = vaporizePixelRatio('medium', box);

    expect(ratio).toBeLessThan(1);
    expect(box.width * box.height * ratio * ratio).toBeCloseTo(500_000);
  });

  it('captures fewer pixels at low quality than at medium', () => {
    const box = { width: 1600, height: 900 };

    expect(vaporizePixelRatio('low', box)).toBeLessThan(
      vaporizePixelRatio('medium', box)
    );
  });

  it('keeps a small phone arena crisp', () => {
    expect(vaporizePixelRatio('medium', { width: 360, height: 200 })).toBe(2);
  });

  it('captures at full device pixels at full quality', () => {
    expect(vaporizePixelRatio('full', { width: 2560, height: 1440 })).toBe(2);
  });

  it('leaves the cap to the effect before the box is laid out', () => {
    expect(vaporizePixelRatio('medium', null)).toBe(2);
    expect(vaporizePixelRatio('medium', { width: 0, height: 0 })).toBe(2);
  });
});

describe('the vaporize settings', () => {
  it('knows its qualities and durations', () => {
    expect(isVaporizeQuality('off')).toBe(true);
    expect(isVaporizeQuality('ultra')).toBe(false);
    expect(isVaporizeMs(2500)).toBe(true);
    expect(isVaporizeMs(1234)).toBe(false);
  });
});
