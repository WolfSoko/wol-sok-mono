import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ArenaPainter } from '../arena/arena-painter';
import type { ArenaViewComponent } from '../arena/arena-view.component';
import { GameStateService } from '../state/game-state.service';
import { isBigMap, LEVELS } from '@wolsok/feat-shared-bacteria-engine';
import { PlayerService } from '../state/player.service';
import { ArenaStage } from './arena-stage';
import { StageFrame } from './stage-frame';

describe('StageFrame', () => {
  let frame: StageFrame;
  let arenaView: {
    clearNext: jest.Mock;
    repaint: jest.Mock;
    canvas: () => HTMLCanvasElement;
  };

  function painter(): ArenaPainter & { setRenderScale: jest.Mock } {
    return {
      kind: 'canvas',
      setFloor: () => undefined,
      paint: () => undefined,
      showLastFrame: () => undefined,
      dispose: () => undefined,
      setRenderScale: jest.fn(),
    };
  }

  function startMatch(levelId: string): void {
    const service = TestBed.inject(GameStateService);
    service.setLevel(levelId);
    service.setMode('vs-computer');
    const { width, height } = TestBed.inject(ArenaStage).arena();
    service.setArenaSize(width, height);
    service.start();
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [ArenaStage, StageFrame] });
    const canvas = document.createElement('canvas');
    arenaView = {
      clearNext: jest.fn(),
      repaint: jest.fn(),
      canvas: () => canvas,
    };
    TestBed.inject(ArenaStage).bind({
      arenaView: signal(arenaView as unknown as ArenaViewComponent),
      ambienceCanvas: signal(undefined),
      minimapCanvas: signal(undefined),
      arenaFrame: () => undefined,
      thanos: () => {
        throw new Error('no effect in these specs');
      },
      declaring: signal(false),
    });
    frame = TestBed.inject(StageFrame);
  });

  describe('a new painter', () => {
    it('gets the war a simulation and the arena its size', () => {
      const use = jest.spyOn(TestBed.inject(PlayerService), 'useSimulations');
      const size = jest.spyOn(TestBed.inject(GameStateService), 'setArenaSize');

      frame.onPainterChange(painter());

      expect(use).toHaveBeenCalledWith(
        expect.objectContaining({
          plays: expect.any(Function),
          offers: expect.any(Function),
        })
      );
      const { width, height } = TestBed.inject(ArenaStage).arena();
      expect(size).toHaveBeenCalledWith(width, height);
      expect(arenaView.repaint).toHaveBeenCalled();
    });

    it('starts at every pixel', () => {
      const built = painter();

      frame.onPainterChange(built);

      expect(built.setRenderScale).toHaveBeenCalledWith(1);
    });

    it('lets the GPU simulation go with the painter before it', () => {
      const use = jest.spyOn(TestBed.inject(PlayerService), 'useSimulations');

      frame.onPainterChange(null);

      expect(use).toHaveBeenCalledWith(null);
    });
  });

  describe('the camera', () => {
    it('follows the one human over a big map', () => {
      const big = LEVELS.find((level) => isBigMap(level.id));
      expect(big).toBeDefined();
      startMatch(big?.id ?? '');
      frame.onPainterChange(painter());

      expect(frame.zooms()).toBe(true);
    });

    it('stays out of the way on a base map', () => {
      const base = LEVELS.find((level) => !isBigMap(level.id));
      startMatch(base?.id ?? '');
      frame.onPainterChange(painter());

      expect(frame.zooms()).toBe(false);
    });
  });

  it('readies the arena for a fresh match', () => {
    frame.newMatch();

    expect(arenaView.clearNext).toHaveBeenCalled();
  });

  it('paints the whole base map, and tags the canvas with what runs the war', () => {
    startMatch(LEVELS[0].id);
    frame.onPainterChange(painter());

    const content = frame.scene.content(1);

    expect(content.ambience).toBeNull();
    expect(arenaView.canvas().dataset['simulation']).toBe(
      TestBed.inject(PlayerService).getSimulation().variant
    );
    expect(frame.scene.view?.()).toEqual({
      x: 0,
      y: 0,
      ...TestBed.inject(ArenaStage).arena(),
    });
  });
});
