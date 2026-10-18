import { TestBed } from '@angular/core/testing';
import { GameSoundService } from './game-sound.service';
import { levelMusic } from './level-music';

describe('GameSoundService', () => {
  it('stays silent without the Web Audio API instead of throwing', () => {
    const sound = TestBed.inject(GameSoundService);

    expect(() => {
      sound.setEnabled(false);
      sound.matchStart();
      sound.boost(false);
      sound.setMusicEnabled(false);
      sound.setMusic(levelMusic('heartbeat'), 3);
      sound.frame({
        boosts: [true],
        captures: 3,
        pelletsEaten: 1,
        crushed: 2,
        gatesClosed: 1,
        gatesWarned: 1,
      });
      sound.matchEnd('win');
      sound.setMusic(null);
    }).not.toThrow();
  });
});
