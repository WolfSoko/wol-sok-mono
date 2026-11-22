import { ElementRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { AnimationState, WsThanosDirective } from '@wolsok/thanos';
import { Subject } from 'rxjs';
import { GameSettingsService } from '../settings.service';
import { GameSoundService } from '../sound/game-sound.service';
import {
  arenaSize,
  ONLINE_SIM_RESOLUTION,
} from '@wolsok/feat-shared-bacteria-engine';
import { GameStateStore } from '../state/game.states';
import { ArenaStage, ArenaStageHost } from './arena-stage';

describe('ArenaStage', () => {
  let stage: ArenaStage;
  let settings: GameSettingsService;
  let declaring: ReturnType<typeof signal<boolean>>;

  /** Binds the stage to a host without a template, but for its effect. */
  function bind(
    thanos: Partial<WsThanosDirective> = {},
    frame?: HTMLDivElement
  ): void {
    const host: ArenaStageHost = {
      arenaView: signal(undefined),
      ambienceCanvas: signal(undefined),
      minimapCanvas: signal(undefined),
      arenaFrame: () =>
        frame === undefined ? undefined : new ElementRef(frame),
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
      settings.set('simResolution', 'low');
      const low = stage.arena();

      declaring.set(true);

      expect(stage.arena()).toEqual(
        arenaSize(ONLINE_SIM_RESOLUTION, stage.mapSize())
      );
      expect(stage.arena()).not.toEqual(low);
    });
  });

  it('keeps the online grid under the result of an online match once the connection is gone', () => {
    settings.set('simResolution', 'low');
    const low = stage.arena();
    const store = TestBed.inject(GameStateStore);

    store.update({ endedBy: 'annihilation', endedOnline: true, online: null });

    expect(stage.arena()).toEqual(
      arenaSize(ONLINE_SIM_RESOLUTION, stage.mapSize())
    );
    expect(stage.arena()).not.toEqual(low);
  });

  describe('the vaporize effect', () => {
    it('snaps only while the sound and the effects are on', () => {
      expect(stage.thanosOptions().sound).toBe(true);
      settings.set('sound', false);
      expect(stage.thanosOptions().sound).toBe(false);
      settings.set('sound', true);
      settings.set('effects', false);
      expect(stage.thanosOptions().sound).toBe(false);
    });

    it('snaps as loud as the other effects', () => {
      const louder = () => stage.thanosOptions().soundVolume ?? 0;

      const atDefault = louder();
      settings.set('effectsVolume', 40);

      expect(louder()).toBeLessThan(atDefault);
      expect(louder()).toBeCloseTo(
        TestBed.inject(GameSoundService).effectsGain() * 0.3
      );
    });

    it('takes as long as set', () => {
      expect(stage.thanosOptions().animationLength).toBe(2500);
      settings.set('vaporizeMs', 5000);
      expect(stage.thanosOptions().animationLength).toBe(5000);
    });

    it('captures the arena within the pixel budget of the quality', () => {
      const pixels = () => stage.thanosOptions().maxCapturePixels;

      expect(pixels()).toBe(500_000);
      settings.set('vaporize', 'low');
      expect(pixels()).toBe(250_000);
      settings.set('vaporize', 'full');
      expect(pixels()).toBeUndefined();
    });

    it('rolls the next snap its own wind as this one starts', () => {
      bind({ vaporize$: () => new Subject<AnimationState>() });
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
      settings.set('vaporize', 'off');
      const vaporize$ = jest.fn(() => new Subject<AnimationState>());
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

  describe('the dissolve at the end of a match', () => {
    let effect: Subject<AnimationState>;
    let vaporize$: jest.Mock;
    let frame: HTMLDivElement;

    beforeEach(() => {
      effect = new Subject<AnimationState>();
      vaporize$ = jest.fn(() => effect);
      frame = document.createElement('div');
      bind({ vaporize$ }, frame);
    });

    it('hides the arena once the dust has settled', () => {
      const done = jest.fn();
      stage.dissolve().subscribe({ complete: done });
      expect(vaporize$).toHaveBeenCalledTimes(1);
      expect(frame.style.visibility).toBe('');

      effect.complete();

      expect(done).toHaveBeenCalled();
      expect(frame.style.visibility).toBe('hidden');
    });

    it('leaves the reset after it no second effect, and the arena hidden', () => {
      stage.dissolve().subscribe();
      effect.complete();
      const done = jest.fn();

      stage.vaporize().subscribe({ complete: done });

      expect(done).toHaveBeenCalled();
      expect(vaporize$).toHaveBeenCalledTimes(1);
      expect(frame.style.visibility).toBe('hidden');
    });

    it('lets a reset begun while the dust still blows wait for it', () => {
      stage.dissolve().subscribe();
      const done = jest.fn();

      stage.vaporize().subscribe({ complete: done });
      expect(done).not.toHaveBeenCalled();
      effect.complete();

      expect(done).toHaveBeenCalled();
      expect(vaporize$).toHaveBeenCalledTimes(1);
    });

    it('vaporizes again on the reset after that one', () => {
      stage.dissolve().subscribe();
      effect.complete();
      stage.vaporize().subscribe();

      stage.vaporize().subscribe();

      expect(vaporize$).toHaveBeenCalledTimes(2);
    });

    it('settles even when the effect fails', () => {
      const consoleError = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      try {
        bind(
          {
            vaporize$: () => {
              throw new Error('no context');
            },
          },
          frame
        );
        const done = jest.fn();

        stage.dissolve().subscribe({ complete: done });

        expect(done).toHaveBeenCalled();
        expect(frame.style.visibility).toBe('hidden');
      } finally {
        consoleError.mockRestore();
      }
    });

    it('leaves no dust to a match that starts without a reset', () => {
      stage.dissolve().subscribe();
      effect.complete();

      stage.newMatch();
      stage.vaporize().subscribe();

      expect(vaporize$).toHaveBeenCalledTimes(2);
    });

    it('shows the arena again with the first frame of a match started after the dust', () => {
      stage.dissolve().subscribe();
      effect.complete();
      expect(frame.style.visibility).toBe('hidden');

      stage.newMatch();
      expect(frame.style.visibility).toBe('hidden');
      stage.arenaPaintedAfterReset();

      expect(frame.style.visibility).toBe('');
    });

    it('hides no arena of a match that started while the dust still blew', () => {
      stage.dissolve().subscribe();

      stage.newMatch();
      effect.complete();

      expect(frame.style.visibility).toBe('');
    });

    it('simply hides the arena while the effect is off', async () => {
      settings.set('vaporize', 'off');
      const done = jest.fn();

      stage.dissolve().subscribe({ complete: done });
      await Promise.resolve();

      expect(vaporize$).not.toHaveBeenCalled();
      expect(done).toHaveBeenCalled();
      expect(frame.style.visibility).toBe('hidden');
    });
  });
});
