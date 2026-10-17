import { TestBed } from '@angular/core/testing';
import { GameSoundService } from './game-sound.service';

describe('GameSoundService', () => {
  it('stays silent without the Web Audio API instead of throwing', () => {
    const sound = TestBed.inject(GameSoundService);

    expect(() => {
      sound.setEnabled(false);
      sound.matchStart();
      sound.boost(false);
      sound.setAmbience(50);
      sound.frame({
        boosts: [true],
        captures: 3,
        pelletsEaten: 1,
        crushed: 2,
        gatesClosed: 1,
        gatesWarned: 1,
      });
      sound.matchEnd('win');
      sound.setAmbience(null);
    }).not.toThrow();
  });
});
