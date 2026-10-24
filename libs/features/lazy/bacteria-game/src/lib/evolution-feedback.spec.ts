import { TestBed } from '@angular/core/testing';
import { GameHapticsService } from './haptics.service';
import { GameSoundService } from './sound/game-sound.service';

/** What a purchase on the Evolution screen sounds and feels like. */
describe('evolution feedback', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: undefined,
    });
  });

  it('stays silent without the Web Audio API instead of throwing', () => {
    const sound = TestBed.inject(GameSoundService);

    expect(() => {
      sound.evolve(1);
      sound.evolve(5, true);
      sound.equip();
      sound.equip(false);
      sound.devolve();
    }).not.toThrow();
  });

  it('kicks the phone as the DNA lands, longer for a gene at the top', () => {
    jest.spyOn(performance, 'now').mockReturnValue(1000);
    const vibrate = jest.fn(() => true);
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: vibrate,
    });
    const haptics = TestBed.inject(GameHapticsService);

    haptics.evolve();
    haptics.evolve(true);

    const [[plain], [maxed]] = vibrate.mock.calls as unknown as number[][][];
    const total = (pattern: number[]) => pattern.reduce((a, b) => a + b, 0);
    expect(total(maxed)).toBeGreaterThan(total(plain));
  });
});
