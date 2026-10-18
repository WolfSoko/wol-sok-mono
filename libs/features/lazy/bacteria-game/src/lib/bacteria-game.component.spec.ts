import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Subject } from 'rxjs';
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

/** Lets the page believe a user gesture is, or is not, still fresh. */
function stubActivation(isActive: boolean): void {
  Object.defineProperty(navigator, 'userActivation', {
    value: { isActive },
    configurable: true,
  });
}

/**
 * A stage whose fullscreen request the browser grants or refuses. A granted
 * request puts the stage on the screen, as the browser would.
 */
function stage(granted: boolean) {
  const arena = {
    requestFullscreen: jest.fn(() => {
      if (!granted) {
        return Promise.reject(new TypeError('no gesture'));
      }
      stubFullscreen(arena as unknown as Element);
      return Promise.resolve();
    }),
  };
  return arena;
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

  /**
   * Creates the component with a stage whose fullscreen request the browser
   * grants or refuses, and returns that stage. The template is not rendered,
   * so the stage element is wired up by hand.
   */
  function create(granted = false) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [BacteriaGameComponent, NoopAnimationsModule],
    });
    query = TestBed.inject(GameStateQuery);
    fixture = TestBed.createComponent(BacteriaGameComponent);
    component = fixture.componentInstance;
    const arena = stage(granted);
    (component as unknown as { stageRef: unknown }).stageRef = {
      nativeElement: arena,
    };
    return arena;
  }

  function startMatch(mode: 'two-players' | 'vs-computer'): PlayerQuery {
    const service = TestBed.inject(GameStateService);
    service.setArenaSize(320, 140);
    service.setMode(mode);
    service.start();
    return TestBed.inject(PlayerQuery);
  }

  beforeEach(() => {
    stubFullscreen(null);
    stubActivation(false);
  });

  describe('the F shortcut', () => {
    it('goes fullscreen for a key pressed in the arena', () => {
      const arena = create();
      component['fullscreen'].set(false);

      component.onKeyDown(keyEvent('f', document.body));

      expect(component['fullscreen']()).toBe(true);
      expect(arena.requestFullscreen).toHaveBeenCalled();
      expect(query.getValue().keysPressed).not.toContain('f');
    });

    it('leaves fullscreen again', () => {
      create();

      component.onKeyDown(keyEvent('f', document.body));

      expect(component['fullscreen']()).toBe(false);
    });

    it('leaves the key to the level picker while that has the focus', () => {
      create();
      component['fullscreen'].set(false);
      const combobox = document.createElement('div');
      combobox.setAttribute('role', 'combobox');

      component.onKeyDown(keyEvent('f', combobox));

      expect(component['fullscreen']()).toBe(false);
    });

    it('leaves the key to an overlay, where the picker opens its panel', () => {
      create();
      component['fullscreen'].set(false);
      const overlay = document.createElement('div');
      overlay.className = 'cdk-overlay-container';
      const option = document.createElement('div');
      overlay.appendChild(option);

      component.onKeyDown(keyEvent('f', option));

      expect(component['fullscreen']()).toBe(false);
    });
  });

  describe('the boost keys', () => {
    function boostOf(playerId: number): number {
      return (
        TestBed.inject(PlayerQuery).getEntity(playerId)?.boostActiveSec ?? 0
      );
    }

    it('fires the first player with Space and the second with Enter', () => {
      create();
      startMatch('two-players');

      component.onKeyDown(keyEvent(' ', document.body));
      expect(boostOf(0)).toBeGreaterThan(0);
      expect(boostOf(1)).toBe(0);

      component.onKeyDown(keyEvent('Enter', document.body));
      expect(boostOf(1)).toBeGreaterThan(0);
    });

    it('gives both keys to the human against the computer', () => {
      create();
      startMatch('vs-computer');

      component.onKeyDown(keyEvent('Enter', document.body));

      expect(boostOf(0)).toBeGreaterThan(0);
      expect(boostOf(1)).toBe(0);
    });

    it('keeps Space from scrolling the page', () => {
      create();
      startMatch('two-players');
      const event = keyEvent(' ', document.body);

      component.onKeyDown(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(query.getValue().keysPressed).not.toContain(' ');
    });

    it('ignores a held key', () => {
      create();
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
      create();
      startMatch('two-players');
      const input = document.createElement('input');

      component.onKeyDown(keyEvent('Enter', input));

      expect(boostOf(1)).toBe(0);
    });

    it('leaves Space and Enter to a focused button', () => {
      create();
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
      create();
      startMatch('two-players');
      const button = document.createElement('button');
      button.disabled = true;

      component.onKeyDown(keyEvent(' ', button));

      expect(boostOf(0)).toBeGreaterThan(0);
    });
  });

  describe('entering the page', () => {
    it('opens in the touch layout', () => {
      create();

      expect(component['fullscreen']()).toBe(true);
    });

    it('does not waste the native request on a page opened without a gesture', () => {
      const arena = create();

      component['requestNativeFullscreenOnOpen']();

      expect(arena.requestFullscreen).not.toHaveBeenCalled();
    });

    it('spends the gesture of the navigation that opened the page', () => {
      const arena = create(true);
      stubActivation(true);

      component['requestNativeFullscreenOnOpen']();

      expect(arena.requestFullscreen).toHaveBeenCalledTimes(1);
    });

    it('asks again with the next gesture once the browser refused', async () => {
      const arena = create();
      component['requestNativeFullscreen']();
      await settle();

      component['togglePause']();

      expect(arena.requestFullscreen).toHaveBeenCalledTimes(2);
    });

    it('stops asking once the browser granted it', async () => {
      const arena = create(true);
      component['requestNativeFullscreen']();
      await settle();

      component['togglePause']();

      expect(arena.requestFullscreen).toHaveBeenCalledTimes(1);
    });

    it('does not ask at all without the API, as on an iPhone', () => {
      create();
      Object.defineProperty(document, 'fullscreenEnabled', {
        value: undefined,
        configurable: true,
      });

      expect(() => component['requestNativeFullscreen']()).not.toThrow();
      expect(component['fullscreen']()).toBe(true);
    });
  });

  describe('leaving fullscreen', () => {
    it('returns to the page and gives the screen back', () => {
      const arena = create(true);
      const exit = stubFullscreen(arena as unknown as Element);

      component['leaveFullscreen']();

      expect(component['fullscreen']()).toBe(false);
      expect(exit).toHaveBeenCalled();
    });

    it('does not pull the player back in with the next gesture', () => {
      const arena = create();
      component['leaveFullscreen']();

      component['togglePause']();

      expect(arena.requestFullscreen).not.toHaveBeenCalled();
    });

    it('follows the browser when it takes the arena off the main menu', () => {
      create();

      component['onFullscreenChange']();

      expect(component['fullscreen']()).toBe(false);
    });

    it('pauses a running match instead when the browser leaves fullscreen', () => {
      create();
      startMatch('vs-computer');

      component['onFullscreenChange']();

      expect(component['paused']()).toBe(true);
      expect(component['fullscreen']()).toBe(true);
    });

    it('keeps a screen open when the browser fullscreen toggle goes off', () => {
      create();
      component['show']('settings');

      component['setNativeFullscreen'](false);
      component['onFullscreenChange']();

      expect(component['fullscreen']()).toBe(true);
      expect(component['panel']()).toBe('settings');
    });

    it('follows the browser into a fullscreen granted after the layout was left', () => {
      const arena = create(true);
      component['leaveFullscreen']();
      stubFullscreen(arena as unknown as Element);

      component['onFullscreenChange']();

      expect(component['fullscreen']()).toBe(true);
    });

    it('leaves on Escape where no browser fullscreen is there to leave', () => {
      create();

      component.onKeyDown(keyEvent('Escape', document.body));

      expect(component['fullscreen']()).toBe(false);
      expect(query.getValue().keysPressed).not.toContain('Escape');
    });
  });

  describe('the menu', () => {
    it('opens on the main menu', () => {
      create();

      expect(component['panel']()).toBe('menu');
    });

    it('shows a screen and comes back', () => {
      create();

      component['show']('settings');
      expect(component['panel']()).toBe('settings');

      component.onKeyDown(keyEvent('Escape', document.body));
      expect(component['panel']()).toBe('menu');
    });

    it('leaves the layout on Escape from the main menu only', () => {
      create();

      component.onKeyDown(keyEvent('Escape', document.body));

      expect(component['fullscreen']()).toBe(false);
    });

    it('gets out of the way while a match is on', () => {
      create();
      startMatch('vs-computer');

      expect(component['panel']()).toBeNull();
    });

    it('pauses the match on Escape and opens the pause menu', () => {
      create();
      startMatch('vs-computer');

      component.onKeyDown(keyEvent('Escape', document.body));

      expect(component['paused']()).toBe(true);
      expect(component['panel']()).toBe('pause');
    });

    it('opens the settings over a paused match', () => {
      create();
      startMatch('vs-computer');
      component['togglePause']();

      component['show']('settings');
      expect(component['panel']()).toBe('settings');

      component.onKeyDown(keyEvent('Escape', document.body));
      expect(component['panel']()).toBe('pause');
    });

    it('resumes a paused match on Escape from the pause menu', () => {
      create();
      startMatch('vs-computer');
      component['togglePause']();

      component.onKeyDown(keyEvent('Escape', document.body));

      expect(component['paused']()).toBe(false);
      expect(component['panel']()).toBeNull();
    });

    it('shows the result once the match is over', () => {
      create();
      startMatch('vs-computer');

      query['store'].update({ matchEnded: true });

      expect(component['panel']()).toBe('over');
    });

    it('switches to the next level only once the old arena is vaporized', () => {
      create();
      startMatch('vs-computer');
      const vaporized = new Subject<void>();
      (component as unknown as { thanos: unknown }).thanos = {
        vaporize: () => vaporized,
      };
      const before = query.getValue().levelId;
      query['store'].update({ matchEnded: true });

      component['onMatchEnd']('next');
      expect(query.getValue().levelId).toBe(before);

      vaporized.complete();
      expect(query.getValue().levelId).not.toBe(before);
    });

    it('puts the arena back on the canvas right before it is vaporized', () => {
      create();
      startMatch('vs-computer');
      const calls: string[] = [];
      (component as unknown as { painter: unknown }).painter = {
        showLastFrame: () => calls.push('show'),
        paint: () => undefined,
        dispose: () => undefined,
      };
      (component as unknown as { thanos: unknown }).thanos = {
        vaporize: () => {
          calls.push('snapshot');
          return new Subject<void>();
        },
      };

      component.resetGame();

      expect(calls).toEqual(['show', 'snapshot']);
    });

    it('names the difficulty next to the level', () => {
      create();
      TestBed.inject(GameStateService).setDifficulty('hard');

      expect(component['difficultyName']()).toBe('Hard');
    });
  });

  describe('the joysticks', () => {
    it('steer the crosshair of their player', () => {
      create();
      const playerQuery = startMatch('two-players');
      const before = playerQuery.getEntity(1)?.x ?? 0;

      component['steer'](1, { x: 1, y: 0 });
      query['store'].update({ timeDelta: 100 });

      expect(playerQuery.getEntity(1)?.x).toBeGreaterThan(before);
      expect(playerQuery.getEntity(0)?.x).toBe(80);
    });
  });
});

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
