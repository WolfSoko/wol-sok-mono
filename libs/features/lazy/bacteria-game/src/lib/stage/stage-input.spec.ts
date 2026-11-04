import { TestBed } from '@angular/core/testing';
import {
  keyEvent,
  stubFullscreen,
  StubStage,
  stubStage,
  stubTouch,
} from '../../testing/fullscreen-stubs';
import { StageBusy } from '../busy/stage-busy';
import { GameStateService } from '../state/game-state.service';
import { GameStateStore } from '../state/game.states';
import { PlayerService } from '../state/player.service';
import { PlayerStore } from '../state/player.store';
import { ArenaStage } from './arena-stage';
import { StageFrame } from './stage-frame';
import { StageFullscreen } from './stage-fullscreen';
import { StageInput } from './stage-input';

describe('StageInput', () => {
  let input: StageInput;
  let fullscreen: StageFullscreen;
  let store: GameStateStore;

  /**
   * Creates the input with the stage's other parts, over a stage element
   * whose fullscreen request the browser refuses, and returns that element.
   * The page runs on a touch device and so opens fullscreen.
   */
  function create(): StubStage {
    stubTouch(true);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [StageFullscreen, ArenaStage, StageFrame, StageInput],
    });
    store = TestBed.inject(GameStateStore);
    fullscreen = TestBed.inject(StageFullscreen);
    input = TestBed.inject(StageInput);
    const arena = stubStage(false);
    fullscreen.bind(() => arena as unknown as HTMLElement);
    return arena;
  }

  function startMatch(mode: 'two-players' | 'vs-computer'): PlayerStore {
    const service = TestBed.inject(GameStateService);
    service.setArenaSize(320, 140);
    service.setMode(mode);
    service.start();
    return TestBed.inject(PlayerStore);
  }

  beforeEach(() => {
    localStorage.clear();
    stubFullscreen(null);
  });

  describe('the F shortcut', () => {
    it('goes fullscreen for a key pressed in the arena', () => {
      const arena = create();
      fullscreen.fullscreen.set(false);

      input.keyDown(keyEvent('f', document.body));

      expect(fullscreen.fullscreen()).toBe(true);
      expect(arena.requestFullscreen).toHaveBeenCalled();
      expect(store.snapshot().keysPressed).not.toContain('f');
    });

    it('leaves fullscreen again', () => {
      create();

      input.keyDown(keyEvent('f', document.body));

      expect(fullscreen.fullscreen()).toBe(false);
    });

    it('leaves the key to the level picker while that has the focus', () => {
      create();
      fullscreen.fullscreen.set(false);
      const combobox = document.createElement('div');
      combobox.setAttribute('role', 'combobox');

      input.keyDown(keyEvent('f', combobox));

      expect(fullscreen.fullscreen()).toBe(false);
    });

    it('leaves the key to an overlay, where the picker opens its panel', () => {
      create();
      fullscreen.fullscreen.set(false);
      const overlay = document.createElement('div');
      overlay.className = 'cdk-overlay-container';
      const option = document.createElement('div');
      overlay.appendChild(option);

      input.keyDown(keyEvent('f', option));

      expect(fullscreen.fullscreen()).toBe(false);
    });
  });

  describe('the boost keys', () => {
    function boostOf(playerId: number): number {
      return (
        TestBed.inject(PlayerStore).entityMap()[playerId]?.boostActiveSec ?? 0
      );
    }

    it('fires the first player with Space and the second with Enter', () => {
      create();
      startMatch('two-players');

      input.keyDown(keyEvent(' ', document.body));
      expect(boostOf(0)).toBeGreaterThan(0);
      expect(boostOf(1)).toBe(0);

      input.keyDown(keyEvent('Enter', document.body));
      expect(boostOf(1)).toBeGreaterThan(0);
    });

    it('gives both keys to the human against the computer', () => {
      create();
      startMatch('vs-computer');

      input.keyDown(keyEvent('Enter', document.body));

      expect(boostOf(0)).toBeGreaterThan(0);
      expect(boostOf(1)).toBe(0);
    });

    it('keeps Space from scrolling the page', () => {
      create();
      startMatch('two-players');
      const event = keyEvent(' ', document.body);

      input.keyDown(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(store.snapshot().keysPressed).not.toContain(' ');
    });

    it('ignores a held key', () => {
      create();
      startMatch('two-players');

      input.keyDown(keyEvent(' ', document.body, true));

      expect(boostOf(0)).toBe(0);
    });

    it('leaves Space to the page while no match is on', () => {
      create();
      TestBed.inject(GameStateService).setArenaSize(320, 140);
      const event = keyEvent(' ', document.body);

      input.keyDown(event);

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(boostOf(0)).toBe(0);
    });

    it('leaves Enter to a focused control', () => {
      create();
      startMatch('two-players');
      const field = document.createElement('input');

      input.keyDown(keyEvent('Enter', field));

      expect(boostOf(1)).toBe(0);
    });

    it('leaves Space and Enter to a focused button', () => {
      create();
      startMatch('two-players');
      const button = document.createElement('button');
      const event = keyEvent('Enter', button);

      input.keyDown(keyEvent(' ', button));
      input.keyDown(event);

      expect(boostOf(0)).toBe(0);
      expect(boostOf(1)).toBe(0);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('takes the key from a disabled button, which cannot use it', () => {
      create();
      startMatch('two-players');
      const button = document.createElement('button');
      button.disabled = true;

      input.keyDown(keyEvent(' ', button));

      expect(boostOf(0)).toBeGreaterThan(0);
    });
  });

  describe('Escape', () => {
    it('is left to the stage, which backs out of what is open', () => {
      create();

      expect(input.keyDown(keyEvent('Escape', document.body))).toBe('escape');
      expect(store.snapshot().keysPressed).not.toContain('Escape');
    });

    it('is not taken while the work of a tap waits to run', () => {
      create();
      jest.spyOn(TestBed.inject(StageBusy), 'active').mockReturnValue(true);

      expect(input.keyDown(keyEvent('Escape', document.body))).toBeNull();
    });
  });

  describe('the joysticks', () => {
    it('steer the crosshair of their player', () => {
      create();
      const playerStore = startMatch('two-players');
      const before = playerStore.entityMap()[1]?.x ?? 0;

      input.steer(1, { x: 1, y: 0 });
      TestBed.inject(GameStateService).advance(320, 140, 3);

      expect(playerStore.entityMap()[1]?.x).toBeGreaterThan(before);
      expect(playerStore.entityMap()[0]?.x).toBe(80);
    });
  });

  describe('fingers on the arena', () => {
    /** A pointer event at a client point, on an element that captures it. */
    function pointer(pointerId: number, x: number, y: number): PointerEvent {
      return {
        pointerId,
        clientX: x,
        clientY: y,
        target: { setPointerCapture: jest.fn() },
        preventDefault: jest.fn(),
      } as unknown as PointerEvent;
    }

    /** Maps a client point onto the arena one to one. */
    function arenaUnderPointer(): void {
      jest
        .spyOn(TestBed.inject(ArenaStage), 'arenaPoint')
        .mockImplementation((event) => ({
          x: event.clientX,
          y: event.clientY,
        }));
    }

    it('drag the crosshair nearest to them', () => {
      create();
      startMatch('two-players');
      arenaUnderPointer();
      const drag = jest.spyOn(TestBed.inject(PlayerService), 'setDragTarget');
      const [left] = TestBed.inject(PlayerStore).entities();

      input.pointerDown(pointer(7, left.x + 1, left.y));
      input.pointerMove(pointer(7, left.x + 20, left.y + 5));

      expect(drag).toHaveBeenLastCalledWith(left.id, left.x + 20, left.y + 5);
    });

    it('let go of the crosshair once lifted', () => {
      create();
      startMatch('two-players');
      arenaUnderPointer();
      const drag = jest.spyOn(TestBed.inject(PlayerService), 'setDragTarget');
      const [left] = TestBed.inject(PlayerStore).entities();
      input.pointerDown(pointer(7, left.x, left.y));

      input.pointerUp(pointer(7, left.x, left.y));
      drag.mockClear();
      input.pointerMove(pointer(7, left.x + 20, left.y));

      expect(drag).not.toHaveBeenCalled();
    });

    it('pinch the camera with a second finger that has no crosshair left', () => {
      create();
      startMatch('vs-computer');
      arenaUnderPointer();
      const frame = TestBed.inject(StageFrame);
      jest.spyOn(frame, 'zooms').mockReturnValue(true);
      const zoom = jest
        .spyOn(frame, 'zoomBy')
        .mockImplementation(() => undefined);
      input.pointerDown(pointer(1, 100, 50));

      input.pointerDown(pointer(2, 120, 50));
      input.pointerMove(pointer(2, 140, 50));

      // The gap between the fingers grew from 20 to 40 pixels.
      expect(zoom).toHaveBeenCalledWith(2);
    });
  });

  describe('the wheel', () => {
    function wheel(deltaY: number): WheelEvent {
      return {
        deltaY,
        deltaMode: 0,
        preventDefault: jest.fn(),
      } as unknown as WheelEvent;
    }

    it('zooms the camera while it follows a player', () => {
      create();
      const frame = TestBed.inject(StageFrame);
      jest.spyOn(frame, 'zooms').mockReturnValue(true);
      const zoom = jest
        .spyOn(frame, 'zoomBy')
        .mockImplementation(() => undefined);
      const event = wheel(-500);

      input.wheel(event);

      expect(zoom).toHaveBeenCalledWith(Math.E);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('scrolls the page otherwise', () => {
      create();
      const event = wheel(-500);

      input.wheel(event);

      expect(event.preventDefault).not.toHaveBeenCalled();
    });
  });
});
