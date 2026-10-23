import { TestBed } from '@angular/core/testing';
import { GameHapticsService } from './haptics.service';
import { GameSettingsService } from './settings.service';
import { FrameEvents } from './state/match-engine';

const QUIET: FrameEvents = {
  boosts: [],
  weapons: [],
  captures: 0,
  pelletsEaten: 0,
  crushed: 0,
  gatesClosed: 0,
  gatesWarned: 0,
};

describe('GameHapticsService', () => {
  let vibrate: jest.Mock;
  let now: number;

  beforeEach(() => {
    localStorage.clear();
    now = 1000;
    jest.spyOn(performance, 'now').mockImplementation(() => now);
    vibrate = jest.fn(() => true);
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: vibrate,
    });
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: undefined,
    });
  });

  it('does nothing where the device cannot vibrate', () => {
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: undefined,
    });
    const haptics = TestBed.inject(GameHapticsService);

    expect(haptics.supported).toBe(false);
    expect(() => {
      haptics.matchStart();
      haptics.frame({ ...QUIET, boosts: [false] });
      haptics.matchEnd('win', true);
      haptics.tap();
      haptics.stop();
    }).not.toThrow();
  });

  it('buzzes for a boost of a human, not of the computer', () => {
    const haptics = TestBed.inject(GameHapticsService);

    haptics.frame({ ...QUIET, boosts: [true] });
    expect(vibrate).not.toHaveBeenCalled();

    haptics.frame({ ...QUIET, boosts: [false] });
    expect(vibrate).toHaveBeenCalledWith([30]);
  });

  it('is felt at most every few frames', () => {
    const haptics = TestBed.inject(GameHapticsService);

    haptics.frame({ ...QUIET, boosts: [false] });
    haptics.frame({ ...QUIET, crushed: 3 });
    expect(vibrate).toHaveBeenCalledTimes(1);

    now += 200;
    haptics.frame({ ...QUIET, crushed: 3 });
    expect(vibrate).toHaveBeenCalledTimes(2);
    expect(vibrate).toHaveBeenLastCalledWith([15]);
  });

  it('lets a gate cut through, and holds short buzzes while it plays', () => {
    const haptics = TestBed.inject(GameHapticsService);

    haptics.frame({ ...QUIET, boosts: [false], gatesClosed: 1 });
    expect(vibrate).toHaveBeenLastCalledWith([70]);

    now += 50;
    haptics.tap();
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it('plays a flourish on top of the win for a medallion', () => {
    const haptics = TestBed.inject(GameHapticsService);

    haptics.matchEnd('win');
    const win = vibrate.mock.calls[0][0] as number[];
    haptics.matchEnd('win', true);
    const medal = vibrate.mock.calls[1][0] as number[];

    expect(medal.length).toBeGreaterThan(win.length);
    expect(medal.slice(0, win.length)).toEqual(win);
  });

  it('keeps still while the setting is off, and stops what was playing', () => {
    const haptics = TestBed.inject(GameHapticsService);
    const settings = TestBed.inject(GameSettingsService);

    settings.setVibration(false);
    haptics.stop();
    expect(vibrate).toHaveBeenCalledWith(0);
    vibrate.mockClear();

    haptics.matchStart();
    haptics.frame({ ...QUIET, gatesClosed: 1 });
    haptics.tap();
    expect(vibrate).not.toHaveBeenCalled();

    settings.setVibration(true);
    haptics.tap();
    expect(vibrate).toHaveBeenCalledWith([12]);
  });
});
