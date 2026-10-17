import {
  exitFullscreen,
  fitInside,
  fullscreenElementOf,
  isFullscreen,
  hasUserActivation,
  isFullscreenSupported,
  lockLandscape,
  requestFullscreen,
  unlockOrientation,
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

describe('exitFullscreen', () => {
  it('leaves fullscreen', () => {
    const exit = jest.fn().mockResolvedValue(undefined);

    expect(
      exitFullscreen({ fullscreenElement: {} as Element, exitFullscreen: exit })
    ).toBe(true);
    expect(exit).toHaveBeenCalled();
  });

  it('does nothing while no element fills the screen', () => {
    const exit = jest.fn();

    expect(
      exitFullscreen({ fullscreenElement: null, exitFullscreen: exit })
    ).toBe(false);
    expect(exit).not.toHaveBeenCalled();
  });

  it('uses the prefixed call when it is the only one', () => {
    const webkitExitFullscreen = jest.fn();

    exitFullscreen({
      webkitFullscreenElement: {} as Element,
      webkitExitFullscreen,
    });

    expect(webkitExitFullscreen).toHaveBeenCalled();
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

describe('requestFullscreen', () => {
  it('asks the browser and settles once it answered', async () => {
    const request = jest.fn(() => Promise.resolve());

    await requestFullscreen({ requestFullscreen: request });

    expect(request).toHaveBeenCalled();
  });

  it('swallows a refusal', async () => {
    await expect(
      requestFullscreen({
        requestFullscreen: () => Promise.reject(new TypeError('no gesture')),
      })
    ).resolves.toBeUndefined();
  });

  it('settles without the API', async () => {
    await expect(requestFullscreen({})).resolves.toBeUndefined();
    await expect(requestFullscreen(null)).resolves.toBeUndefined();
  });

  it('falls back to the webkit call, which returns nothing', async () => {
    const webkitRequestFullscreen = jest.fn();

    await expect(
      requestFullscreen({ webkitRequestFullscreen })
    ).resolves.toBeUndefined();
    expect(webkitRequestFullscreen).toHaveBeenCalled();
  });
});

describe('hasUserActivation', () => {
  it('is true while a gesture may still be spent', () => {
    expect(hasUserActivation({ userActivation: { isActive: true } })).toBe(
      true
    );
  });

  it('is false once it is spent, and without the API', () => {
    expect(hasUserActivation({ userActivation: { isActive: false } })).toBe(
      false
    );
    expect(hasUserActivation({})).toBe(false);
  });
});

describe('lockLandscape', () => {
  it('asks for landscape', () => {
    const lock = jest.fn().mockResolvedValue(undefined);

    lockLandscape({ orientation: { lock } });

    expect(lock).toHaveBeenCalledWith('landscape');
  });

  it('swallows a refusal', async () => {
    const lock = jest.fn().mockRejectedValue(new Error('not supported'));

    expect(() => lockLandscape({ orientation: { lock } })).not.toThrow();
    await Promise.resolve();
  });

  it('does nothing without the API', () => {
    expect(() => lockLandscape({})).not.toThrow();
  });
});

describe('unlockOrientation', () => {
  it('releases the lock', () => {
    const unlock = jest.fn();

    unlockOrientation({ orientation: { unlock } });

    expect(unlock).toHaveBeenCalled();
  });

  it('does nothing without the API', () => {
    expect(() => unlockOrientation({})).not.toThrow();
  });
});
