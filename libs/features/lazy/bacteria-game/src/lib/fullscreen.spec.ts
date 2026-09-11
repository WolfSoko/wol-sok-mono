import {
  fitInside,
  fullscreenElementOf,
  isFullscreen,
  isFullscreenSupported,
  toggleFullscreen,
} from './fullscreen';

describe('fullscreenElementOf', () => {
  it('reads the standard property', () => {
    const element = {} as Element;

    expect(fullscreenElementOf({ fullscreenElement: element })).toBe(element);
  });

  it('falls back to the webkit property', () => {
    const element = {} as Element;

    expect(fullscreenElementOf({ webkitFullscreenElement: element })).toBe(
      element
    );
  });
});

describe('isFullscreen', () => {
  it('is false while nothing fills the screen', () => {
    expect(isFullscreen({ fullscreenElement: null })).toBe(false);
  });

  it('is true for the element that fills the screen', () => {
    const element = {} as Element;

    expect(isFullscreen({ fullscreenElement: element }, element)).toBe(true);
  });

  it('is false while another element fills the screen', () => {
    expect(isFullscreen({ fullscreenElement: {} as Element }, {})).toBe(false);
  });
});

describe('isFullscreenSupported', () => {
  it('is true when the browser offers the API', () => {
    expect(
      isFullscreenSupported(
        { fullscreenEnabled: true },
        { requestFullscreen: jest.fn() }
      )
    ).toBe(true);
  });

  it('is false when the browser has the API switched off', () => {
    expect(
      isFullscreenSupported(
        { fullscreenEnabled: false },
        { requestFullscreen: jest.fn() }
      )
    ).toBe(false);
  });

  it('is false without an element to show', () => {
    expect(isFullscreenSupported({ fullscreenEnabled: true }, null)).toBe(
      false
    );
  });
});

describe('toggleFullscreen', () => {
  it('requests fullscreen for the element', () => {
    const requestFullscreen = jest.fn().mockResolvedValue(undefined);

    expect(
      toggleFullscreen({ fullscreenElement: null }, { requestFullscreen })
    ).toBe(true);
    expect(requestFullscreen).toHaveBeenCalled();
  });

  it('exits when something already fills the screen', () => {
    const exitFullscreen = jest.fn().mockResolvedValue(undefined);
    const element = {} as Element;

    expect(
      toggleFullscreen({ fullscreenElement: element, exitFullscreen }, {})
    ).toBe(true);
    expect(exitFullscreen).toHaveBeenCalled();
  });

  it('uses the prefixed calls when they are the only ones', () => {
    const webkitRequestFullscreen = jest.fn();

    toggleFullscreen({}, { webkitRequestFullscreen });

    expect(webkitRequestFullscreen).toHaveBeenCalled();
  });

  it('reports that nothing happened when the browser has no API', () => {
    expect(toggleFullscreen({}, {})).toBe(false);
  });

  it('swallows a rejected request - a refused gesture must not break the game', () => {
    const requestFullscreen = jest.fn().mockRejectedValue(new Error('denied'));

    expect(() => toggleFullscreen({}, { requestFullscreen })).not.toThrow();
  });
});

describe('fitInside', () => {
  it('fills the width when the box is taller than the arena', () => {
    expect(fitInside(640, 1000, 320, 140)).toEqual({ width: 640, height: 280 });
  });

  it('fills the height when the box is wider than the arena', () => {
    expect(fitInside(1920, 280, 320, 140)).toEqual({ width: 640, height: 280 });
  });

  it('keeps the aspect ratio of the arena', () => {
    const size = fitInside(1913, 1071, 320, 140);

    expect(size).not.toBeNull();
    expect((size?.width ?? 0) / (size?.height ?? 1)).toBeCloseTo(320 / 140, 1);
    expect(size?.width).toBeLessThanOrEqual(1913);
    expect(size?.height).toBeLessThanOrEqual(1071);
  });

  it('has no size for a box that has no layout yet', () => {
    expect(fitInside(0, 0, 320, 140)).toBeNull();
  });
});
