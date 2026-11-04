import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { WsThanosDirective } from '@wolsok/thanos';
import { Subject } from 'rxjs';
import { GameSettingsService } from '../settings.service';
import { GameSoundService } from '../sound/game-sound.service';
import { arenaSize, ONLINE_SIM_RESOLUTION } from '../state/arena-size';
import { ArenaStage, ArenaStageHost } from './arena-stage';

describe('ArenaStage', () => {
  let stage: ArenaStage;
  let settings: GameSettingsService;
  let declaring: ReturnType<typeof signal<boolean>>;

  /** Binds the stage to a host without a template, but for its effect. */
  function bind(thanos: Partial<WsThanosDirective> = {}): void {
    const host: ArenaStageHost = {
      arenaView: signal(undefined),
      ambienceCanvas: signal(undefined),
      minimapCanvas: signal(undefined),
      arenaFrame: () => undefined,
      thanos: () => thanos as WsThanosDirective,
      declaring,
    };
    stage.bind(host);
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [ArenaStage] });
    stage = TestBed.inject(ArenaStage);
    settings = TestBed.inject(GameSettingsService);
    declaring = signal(false);
    bind();
  });

  describe('the grid', () => {
    it('plays the online grid from the declaration of a ranked attempt on', () => {
      settings.setSimResolution('low');
      const low = stage.arena();

      declaring.set(true);

      expect(stage.arena()).toEqual(
        arenaSize(ONLINE_SIM_RESOLUTION, stage.mapSize())
      );
      expect(stage.arena()).not.toEqual(low);
    });
  });

  describe('the vaporize effect', () => {
    it('snaps only while the sound and the effects are on', () => {
      expect(stage.thanosOptions().sound).toBe(true);
      settings.setSound(false);
      expect(stage.thanosOptions().sound).toBe(false);
      settings.setSound(true);
      settings.setEffects(false);
      expect(stage.thanosOptions().sound).toBe(false);
    });

    it('snaps as loud as the other effects', () => {
      const louder = () => stage.thanosOptions().soundVolume ?? 0;

      const atDefault = louder();
      settings.setEffectsVolume(40);

      expect(louder()).toBeLessThan(atDefault);
      expect(louder()).toBeCloseTo(
        TestBed.inject(GameSoundService).effectsGain() * 0.3
      );
    });

    it('takes as long as set', () => {
      expect(stage.thanosOptions().animationLength).toBe(2500);
      settings.setVaporizeMs(5000);
      expect(stage.thanosOptions().animationLength).toBe(5000);
    });

    it('captures the arena within the pixel budget of the quality', () => {
      const pixels = () => stage.thanosOptions().maxCapturePixels;

      expect(pixels()).toBe(500_000);
      settings.setVaporize('low');
      expect(pixels()).toBe(250_000);
      settings.setVaporize('full');
      expect(pixels()).toBeUndefined();
    });

    it('rolls the next snap its own wind as this one starts', () => {
      bind({ vaporize$: () => new Subject<void>() });
      const random = jest.spyOn(Math, 'random');
      try {
        random.mockReturnValue(0.1);
        stage.vaporize();
        expect(stage.thanosOptions().windDirection).toBe(36);

        random.mockReturnValue(0.9);
        stage.vaporize();
        expect(stage.thanosOptions().windDirection).toBe(324);
      } finally {
        random.mockRestore();
      }
    });

    it('simply clears the arena while the effect is off', async () => {
      settings.setVaporize('off');
      const vaporize$ = jest.fn(() => new Subject<void>());
      bind({ vaporize$ });
      const done = jest.fn();

      stage.vaporize().subscribe({ complete: done });
      // Like the effect, it is over only after the caller is through.
      expect(done).not.toHaveBeenCalled();
      await Promise.resolve();

      expect(vaporize$).not.toHaveBeenCalled();
      expect(done).toHaveBeenCalled();
    });
  });
});
