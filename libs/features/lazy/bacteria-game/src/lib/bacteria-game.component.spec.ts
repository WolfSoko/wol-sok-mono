import {
  FullscreenOverlayContainer,
  OverlayContainer,
} from '@angular/cdk/overlay';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { BacteriaGameComponent } from './bacteria-game.component';
import { GameStateQuery } from './state/game-state.query';
import { GameStateService } from './state/game-state.service';
import { PlayerQuery } from './state/player.query';

/**
 * Lets the helpers believe the browser offers the API and that the given
 * element is on the screen.
 */
function stubFullscreen(element: Element | null): jest.Mock {
  const exit = jest.fn();
  Object.defineProperty(document, 'fullscreenEnabled', {
    value: true,
    configurable: true,
  });
  Object.defineProperty(document, 'fullscreenElement', {
    value: element,
    configurable: true,
  });
  Object.defineProperty(document, 'exitFullscreen', {
    value: exit,
    configurable: true,
  });
  return exit;
}

/** A stage whose fullscreen request the browser grants or refuses. */
function stage(granted: boolean) {
  const requestFullscreen = jest.fn(() =>
    granted ? Promise.resolve() : Promise.reject(new TypeError('no gesture'))
  );
  return { requestFullscreen };
}

/**
 * Lets the fullscreen request settle. Microtasks only: a timer would run the
 * change detection, which renders the canvas that jsdom cannot draw on.
 */
async function settle(): Promise<void> {
  for (let hop = 0; hop < 5; hop++) {
    await Promise.resolve();
  }
}

describe('BacteriaGameComponent', () => {
  let fixture: ComponentFixture<BacteriaGameComponent>;
  let component: BacteriaGameComponent;
  let query: GameStateQuery;

  function create(fullscreenAwareOverlay = false) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [BacteriaGameComponent, NoopAnimationsModule],
      providers: fullscreenAwareOverlay
        ? [{ provide: OverlayContainer, useClass: FullscreenOverlayContainer }]
        : [],
    });
    query = TestBed.inject(GameStateQuery);
    fixture = TestBed.createComponent(BacteriaGameComponent);
    component = fixture.componentInstance;
  }

  afterEach(() => {
    stubFullscreen(null);
  });

  describe('the F shortcut', () => {
    it('goes fullscreen for a key pressed in the arena', () => {
      create();
      const requestFullscreen = jest.fn();
      setStage(component, { requestFullscreen });
      stubFullscreen(null);

      component.onKeyDown(keyEvent('f', document.body));

      expect(requestFullscreen).toHaveBeenCalled();
      expect(query.getValue().keysPressed).not.toContain('f');
    });

    it('leaves the key to the level picker while that has the focus', () => {
      create();
      const requestFullscreen = jest.fn();
      setStage(component, { requestFullscreen });
      const combobox = document.createElement('div');
      combobox.setAttribute('role', 'combobox');

      component.onKeyDown(keyEvent('f', combobox));

      expect(requestFullscreen).not.toHaveBeenCalled();
    });

    it('leaves the key to an overlay, where the picker opens its panel', () => {
      create();
      const requestFullscreen = jest.fn();
      setStage(component, { requestFullscreen });
      const overlay = document.createElement('div');
      overlay.className = 'cdk-overlay-container';
      const option = document.createElement('div');
      overlay.appendChild(option);

      component.onKeyDown(keyEvent('f', option));

      expect(requestFullscreen).not.toHaveBeenCalled();
    });
  });

  describe('the boost keys', () => {
    function startMatch(mode: 'two-players' | 'vs-computer') {
      create();
      const service = TestBed.inject(GameStateService);
      service.setArenaSize(320, 140);
      service.setMode(mode);
      service.start();
    }

    function boostOf(playerId: number): number {
      return (
        TestBed.inject(PlayerQuery).getEntity(playerId)?.boostActiveSec ?? 0
      );
    }

    it('fires the first player with Space and the second with Enter', () => {
      startMatch('two-players');

      component.onKeyDown(keyEvent(' ', document.body));
      expect(boostOf(0)).toBeGreaterThan(0);
      expect(boostOf(1)).toBe(0);

      component.onKeyDown(keyEvent('Enter', document.body));
      expect(boostOf(1)).toBeGreaterThan(0);
    });

    it('gives both keys to the human against the computer', () => {
      startMatch('vs-computer');

      component.onKeyDown(keyEvent('Enter', document.body));

      expect(boostOf(0)).toBeGreaterThan(0);
      expect(boostOf(1)).toBe(0);
    });

    it('keeps Space from scrolling the page', () => {
      startMatch('two-players');
      const event = keyEvent(' ', document.body);

      component.onKeyDown(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(query.getValue().keysPressed).not.toContain(' ');
    });

    it('ignores a held key', () => {
      startMatch('two-players');

      component.onKeyDown(keyEvent(' ', document.body, true));

      expect(boostOf(0)).toBe(0);
    });

    it('leaves Space to the page while no match is on', () => {
      create();
      TestBed.inject(GameStateService).setArenaSize(320, 140);
      const event = keyEvent(' ', document.body);

      component.onKeyDown(event);

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(boostOf(0)).toBe(0);
    });

    it('leaves Enter to a focused control', () => {
      startMatch('two-players');
      const input = document.createElement('input');

      component.onKeyDown(keyEvent('Enter', input));

      expect(boostOf(1)).toBe(0);
    });

    it('leaves Space and Enter to a focused button', () => {
      startMatch('two-players');
      const button = document.createElement('button');
      const event = keyEvent('Enter', button);

      component.onKeyDown(keyEvent(' ', button));
      component.onKeyDown(event);

      expect(boostOf(0)).toBe(0);
      expect(boostOf(1)).toBe(0);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('takes the key from a disabled button, which cannot use it', () => {
      startMatch('two-players');
      const button = document.createElement('button');
      button.disabled = true;

      component.onKeyDown(keyEvent(' ', button));

      expect(boostOf(0)).toBeGreaterThan(0);
    });
  });

  describe('entering the page', () => {
    it('lays the arena over the whole viewport right away', () => {
      create();
      setStage(component, stage(false));
      stubFullscreen(null);

      component['enterFullscreen']();

      expect(component['fullscreen']()).toBe(true);
    });

    it('asks the browser for its fullscreen as well', () => {
      create();
      const arena = stage(true);
      setStage(component, arena);
      stubFullscreen(null);

      component['enterFullscreen']();

      expect(arena.requestFullscreen).toHaveBeenCalledTimes(1);
    });

    it('asks again on the first gesture once the browser refused', async () => {
      create();
      const arena = stage(false);
      setStage(component, arena);
      stubFullscreen(null);
      component['enterFullscreen']();
      await settle();

      component['onDocumentPointerUp'](pointerUp(document.body));

      expect(arena.requestFullscreen).toHaveBeenCalledTimes(2);
    });

    it('leaves a button gesture to the button', async () => {
      create();
      const arena = stage(false);
      setStage(component, arena);
      stubFullscreen(null);
      component['enterFullscreen']();
      await settle();

      component['onDocumentPointerUp'](
        pointerUp(document.createElement('button'))
      );

      expect(arena.requestFullscreen).toHaveBeenCalledTimes(1);
    });

    it('stops asking once the browser granted it', async () => {
      create();
      const arena = stage(true);
      setStage(component, arena);
      stubFullscreen(null);
      component['enterFullscreen']();
      await settle();

      component['onDocumentPointerUp'](pointerUp(document.body));
      component['onDocumentClick']();

      expect(arena.requestFullscreen).toHaveBeenCalledTimes(1);
    });

    it('does not ask at all without the API, as on an iPhone', () => {
      create();
      const arena = { webkitRequestFullscreen: undefined };
      setStage(component, arena);
      Object.defineProperty(document, 'fullscreenEnabled', {
        value: undefined,
        configurable: true,
      });

      component['enterFullscreen']();
      component['onDocumentClick']();

      expect(component['fullscreen']()).toBe(true);
    });
  });

  describe('leaving fullscreen', () => {
    it('returns to the page and gives the screen back', () => {
      create();
      const arena = stage(true);
      setStage(component, arena);
      const exit = stubFullscreen(arena as unknown as Element);
      component['enterFullscreen']();

      component['leaveFullscreen']();

      expect(component['fullscreen']()).toBe(false);
      expect(exit).toHaveBeenCalled();
    });

    it('does not pull the player back in on the next tap', async () => {
      create();
      const arena = stage(false);
      setStage(component, arena);
      stubFullscreen(null);
      component['enterFullscreen']();
      await settle();
      component['leaveFullscreen']();

      component['onDocumentPointerUp'](pointerUp(document.body));
      component['onDocumentClick']();

      expect(arena.requestFullscreen).toHaveBeenCalledTimes(1);
    });

    it('follows the browser when it takes the arena off the screen', () => {
      create();
      setStage(component, stage(true));
      stubFullscreen(null);
      component['fullscreen'].set(true);

      component['onFullscreenChange']();

      expect(component['fullscreen']()).toBe(false);
    });

    it('leaves on Escape where no browser fullscreen is there to leave', () => {
      create();
      setStage(component, stage(false));
      stubFullscreen(null);
      component['fullscreen'].set(true);

      component.onKeyDown(keyEvent('Escape', document.body));

      expect(component['fullscreen']()).toBe(false);
      expect(query.getValue().keysPressed).not.toContain('Escape');
    });

    it('toggles with F', () => {
      create();
      setStage(component, stage(false));
      stubFullscreen(null);
      component['fullscreen'].set(true);

      component.onKeyDown(keyEvent('f', document.body));

      expect(component['fullscreen']()).toBe(false);
    });
  });

  describe('the joysticks', () => {
    it('steer the crosshair of their player', () => {
      create();
      const service = TestBed.inject(GameStateService);
      service.setArenaSize(320, 140);
      service.setMode('two-players');
      service.start();
      const playerQuery = TestBed.inject(PlayerQuery);
      const before = playerQuery.getEntity(1)?.x ?? 0;

      component['steer'](1, { x: 1, y: 0 });
      query['store'].update({ timeDelta: 100 });

      expect(playerQuery.getEntity(1)?.x).toBeGreaterThan(before);
      expect(playerQuery.getEntity(0)?.x).toBe(80);
    });
  });

  describe('the winner dialog', () => {
    it('leaves fullscreen while the overlays stay outside of it', () => {
      create();
      const exit = stubFullscreen(document.createElement('div'));
      component['fullscreen'].set(true);

      component['leaveFullscreenForDialog']();

      expect(exit).toHaveBeenCalled();
    });

    it('stays fullscreen when the overlays move into the arena', () => {
      create(true);
      const exit = stubFullscreen(document.createElement('div'));
      component['fullscreen'].set(true);

      component['leaveFullscreenForDialog']();

      expect(exit).not.toHaveBeenCalled();
    });

    it('does nothing while the arena is in the page anyway', () => {
      create();
      const exit = stubFullscreen(null);

      component['leaveFullscreenForDialog']();

      expect(exit).not.toHaveBeenCalled();
    });
  });
});

/** The stage element is only wired up by the template, which is not rendered here. */
function setStage(component: BacteriaGameComponent, nativeElement: unknown) {
  (component as unknown as { stageRef: unknown }).stageRef = { nativeElement };
}

function pointerUp(target: EventTarget): PointerEvent {
  return { target, pointerId: 1 } as unknown as PointerEvent;
}

function keyEvent(
  key: string,
  target: EventTarget,
  repeat = false
): KeyboardEvent {
  return {
    key,
    repeat,
    target,
    preventDefault: jest.fn(),
  } as unknown as KeyboardEvent;
}
