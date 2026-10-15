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

/** Lets the helpers believe the arena is on the screen. */
function stubFullscreen(element: Element | null): jest.Mock {
  const exit = jest.fn();
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
