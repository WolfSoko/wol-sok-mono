import { computeCaptureScale } from './capture-scale';

describe('computeCaptureScale', () => {
  const smallCard = { width: 300, height: 400 };

  it('should use the device pixel ratio for crisp particles', () => {
    expect(
      computeCaptureScale({
        ...smallCard,
        devicePixelRatio: 1.5,
        maxCanvasSize: 16384,
      })
    ).toBe(1.5);
  });

  it('should cap the device pixel ratio at 2', () => {
    expect(
      computeCaptureScale({
        ...smallCard,
        devicePixelRatio: 3,
        maxCanvasSize: 16384,
      })
    ).toBe(2);
  });

  it('should stay within the max capture pixels, below css pixels if needed', () => {
    const scale = computeCaptureScale({
      width: 1600,
      height: 900,
      devicePixelRatio: 2,
      maxCanvasSize: 16384,
      maxCapturePixels: 360_000,
    });
    expect(scale).toBeCloseTo(0.5);
    expect(1600 * scale * 900 * scale).toBeCloseTo(360_000);
  });

  it('should keep a small element crisp within the max capture pixels', () => {
    expect(
      computeCaptureScale({
        ...smallCard,
        devicePixelRatio: 2,
        maxCanvasSize: 16384,
        maxCapturePixels: 1_000_000,
      })
    ).toBe(2);
  });

  it('should ignore max capture pixels that are not above 0', () => {
    for (const maxCapturePixels of [0, -1, NaN]) {
      expect(
        computeCaptureScale({
          ...smallCard,
          devicePixelRatio: 2,
          maxCanvasSize: 16384,
          maxCapturePixels,
        })
      ).toBe(2);
    }
  });

  it('should shrink so the 5x taller effect canvas fits the device limit', () => {
    // 800px * 5 (effect height) * scale must stay <= 4096
    const scale = computeCaptureScale({
      width: 300,
      height: 800,
      devicePixelRatio: 2,
      maxCanvasSize: 4096,
    });
    expect(800 * 5 * scale).toBeLessThanOrEqual(4096);
    expect(scale).toBeCloseTo(4096 / 4000);
  });

  it('should shrink so the 2x wider effect canvas fits the device limit', () => {
    const scale = computeCaptureScale({
      width: 3000,
      height: 100,
      devicePixelRatio: 1,
      maxCanvasSize: 4096,
    });
    expect(3000 * 2 * scale).toBeLessThanOrEqual(4096);
  });

  it('should fall back to 1 for an unknown device pixel ratio', () => {
    expect(
      computeCaptureScale({
        ...smallCard,
        devicePixelRatio: 0,
        maxCanvasSize: 16384,
      })
    ).toBe(1);
  });
});
