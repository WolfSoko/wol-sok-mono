import { StageBusy } from './busy/stage-busy';
import { Provider } from '@angular/core';
import {
  ComponentFixture,
  ComponentFixtureAutoDetect,
  TestBed,
} from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Observable, Subject } from 'rxjs';
import type { ArenaFrame, ArenaPainter } from './arena/arena-painter';
import { arenaTheme } from './arena/arena-theme';
import { ARENA_PAINTER_FACTORY } from './arena/arena-view.component';
import { BacteriaGameComponent } from './bacteria-game.component';
import { CampaignService } from './campaign.service';
import { I18nService } from './i18n/i18n.service';
import { PROGRESS_STORAGE_KEY } from './progress.service';
import { GameSettingsService } from './settings.service';
import { GameStateService } from './state/game-state.service';
import { GameState, GameStateStore } from './state/game.states';
import { LEVELS, levelTitle } from '@wolsok/feat-shared-bacteria-engine';
import { PlayerStore } from './state/player.store';
import {
  keyEvent,
  settle,
  stubActivation,
  stubFullscreen,
  StubStage,
  stubStage,
  stubTouch,
} from '../testing/fullscreen-stubs';

describe('BacteriaGameComponent', () => {
  let fixture: ComponentFixture<BacteriaGameComponent>;
  let component: BacteriaGameComponent;
  let store: GameStateStore;

  /**
   * Creates the component with a stage whose fullscreen request the browser
   * grants or refuses, and returns that stage. The template is not rendered,
   * so the stage element is wired up by hand. Unless told otherwise, the
   * page runs on a touch device and so opens fullscreen. A test that lets
   * timers run passes `autoDetect: false`: the change detection a timer
   * would run renders the template, with the canvas jsdom cannot draw on.
   */
  function create(
    granted = false,
    touch = true,
    autoDetect = true,
    providers: Provider[] = []
  ) {
    stubTouch(touch);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [BacteriaGameComponent, NoopAnimationsModule],
      providers: [
        { provide: ComponentFixtureAutoDetect, useValue: autoDetect },
        ...providers,
      ],
    });
    store = TestBed.inject(GameStateStore);
    fixture = TestBed.createComponent(BacteriaGameComponent);
    component = fixture.componentInstance;
    const arena = stubStage(granted);
    (component as unknown as { stageRef: unknown }).stageRef = {
      nativeElement: arena,
    };
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
    stubActivation(false);
  });

  /** Stores a win on a level, as an earlier visit would have. */
  function storeWin(levelId: string): void {
    localStorage.setItem(
      PROGRESS_STORAGE_KEY,
      JSON.stringify({ medals: { [levelId]: { easy: 'bronze' } } })
    );
  }

  describe('entering the page', () => {
    it('opens embedded in the page on a desktop, on the main menu', () => {
      const arena = create(false, false);

      expect(component['stageFullscreen'].fullscreen()).toBe(false);
      expect(component['flow'].panel()).toBe('menu');
      expect(component['flow'].screenOpen()).toBe(true);

      component['flow'].startGame();
      expect(arena.requestFullscreen).not.toHaveBeenCalled();
    });

    it('asks again with the next gesture once the browser refused', async () => {
      const arena = create();
      component['stageFullscreen'].requestNative();
      await settle();

      component['flow'].togglePause();

      expect(arena.requestFullscreen).toHaveBeenCalledTimes(2);
    });

    it('stops asking once the browser granted it', async () => {
      const arena = create(true);
      component['stageFullscreen'].requestNative();
      await settle();

      component['flow'].togglePause();

      expect(arena.requestFullscreen).toHaveBeenCalledTimes(1);
    });
  });

  describe('leaving fullscreen', () => {
    it('does not pull the player back in with the next gesture', () => {
      const arena = create();
      component['stageFullscreen'].leave();

      component['flow'].togglePause();

      expect(arena.requestFullscreen).not.toHaveBeenCalled();
    });

    /**
     * Puts the stage on the screen, as the browser tells it, and takes it
     * off again - the handler sees both changes, as it would in a browser.
     */
    function screenTakenOffStage(arena: StubStage): void {
      stubFullscreen(arena as unknown as Element);
      component['onFullscreenChange']();
      stubFullscreen(null);
      component['onFullscreenChange']();
    }

    it('follows the browser when it takes the arena off the main menu', () => {
      const arena = create();

      screenTakenOffStage(arena);

      expect(component['stageFullscreen'].fullscreen()).toBe(false);
    });

    it('pauses a running match instead when the browser leaves fullscreen', () => {
      const arena = create();
      startMatch('vs-computer');

      screenTakenOffStage(arena);

      expect(component['hud'].paused()).toBe(true);
      expect(component['stageFullscreen'].fullscreen()).toBe(true);
    });

    it('pauses a match counting down when the browser leaves fullscreen', () => {
      const arena = create();
      startMatch('vs-computer');
      store.update({ currentState: GameState.COUNTDOWN, countdown: 2 });

      screenTakenOffStage(arena);

      expect(component['hud'].paused()).toBe(true);
    });

    /** A player inside the stage, which takes the screen for itself. */
    function playerInside(arena: StubStage): Element {
      const player = document.createElement('div');
      arena.contains = (node) => node === player;
      return player;
    }

    it('does not pause a match when the screen a player inside the stage held goes away', () => {
      const arena = create();
      const player = playerInside(arena);
      startMatch('vs-computer');
      stubFullscreen(player);
      component['onFullscreenChange']();

      stubFullscreen(null);
      component['onFullscreenChange']();

      expect(component['hud'].paused()).toBe(false);
      expect(component['stageFullscreen'].fullscreen()).toBe(true);
    });

    it('keeps a screen open when the browser fullscreen toggle goes off', () => {
      create();
      component['flow'].show('settings');

      component['stageFullscreen'].setNative(false);
      component['onFullscreenChange']();

      expect(component['stageFullscreen'].fullscreen()).toBe(true);
      expect(component['flow'].panel()).toBe('settings');
    });

    it('leaves on Escape where no browser fullscreen is there to leave', () => {
      create();

      component.onKeyDown(keyEvent('Escape', document.body));

      expect(component['stageFullscreen'].fullscreen()).toBe(false);
      expect(store.snapshot().keysPressed).not.toContain('Escape');
    });
  });

  describe('the menu', () => {
    it('opens on the main menu', () => {
      create();

      expect(component['flow'].panel()).toBe('menu');
    });

    it('shows a screen and comes back', () => {
      create();

      component['flow'].show('settings');
      expect(component['flow'].panel()).toBe('settings');

      component.onKeyDown(keyEvent('Escape', document.body));
      expect(component['flow'].panel()).toBe('menu');
    });

    it('takes no key while the work of a tap waits to run', () => {
      create();
      component['flow'].show('new-game');

      TestBed.inject(StageBusy).run(() => undefined);
      component.onKeyDown(keyEvent('Escape', document.body));

      expect(component['flow'].panel()).toBe('new-game');
    });

    it('leaves fullscreen on Escape from the main menu only', () => {
      create();

      component.onKeyDown(keyEvent('Escape', document.body));

      expect(component['stageFullscreen'].fullscreen()).toBe(false);
    });

    it('gets out of the way while a match is on', () => {
      create();
      startMatch('vs-computer');

      expect(component['flow'].panel()).toBeNull();
    });

    it('pauses the match on Escape and opens the pause menu', () => {
      create();
      startMatch('vs-computer');

      component.onKeyDown(keyEvent('Escape', document.body));

      expect(component['hud'].paused()).toBe(true);
      expect(component['flow'].panel()).toBe('pause');
    });

    it('opens the settings over a paused match', () => {
      create();
      startMatch('vs-computer');
      component['flow'].togglePause();

      component['flow'].show('settings');
      expect(component['flow'].panel()).toBe('settings');

      component.onKeyDown(keyEvent('Escape', document.body));
      expect(component['flow'].panel()).toBe('pause');
    });

    it('resumes a paused match on Escape from the pause menu', () => {
      create();
      startMatch('vs-computer');
      component['flow'].togglePause();

      component.onKeyDown(keyEvent('Escape', document.body));

      expect(component['hud'].paused()).toBe(false);
      expect(component['flow'].panel()).toBeNull();
    });

    it('shows the result once the match is over', () => {
      create();
      startMatch('vs-computer');

      store.update({ endedBy: 'annihilation' });

      expect(component['flow'].panel()).toBe('over');
    });

    it('switches to the next level only once the old arena is vaporized', () => {
      storeWin(LEVELS[0].id);
      create();
      startMatch('vs-computer');
      const vaporized = new Subject<void>();
      (component as unknown as { thanos: unknown }).thanos = {
        vaporize$: () => vaporized,
      };
      const before = store.snapshot().levelId;
      store.update({ endedBy: 'annihilation' });

      component['matchEnd'].onMatchEnd('next');
      expect(store.snapshot().levelId).toBe(before);

      vaporized.complete();
      expect(store.snapshot().levelId).not.toBe(before);
    });

    it('puts the arena back on the canvas right before it is vaporized', () => {
      create();
      startMatch('vs-computer');
      const calls: string[] = [];
      (component['arenaStage'] as unknown as { painter: unknown }).painter = {
        showLastFrame: () => calls.push('show'),
        paint: () => undefined,
        dispose: () => undefined,
      };
      (component as unknown as { thanos: unknown }).thanos = {
        vaporize$: () => {
          calls.push('snapshot');
          return new Subject<void>();
        },
      };

      component['flow'].resetGame();

      expect(calls).toEqual(['show', 'snapshot']);
    });

    it('goes on without the effect when it never ends, and cancels it', () => {
      jest.useFakeTimers();
      try {
        create(false, true, false);
        startMatch('vs-computer');
        const settings = TestBed.inject(GameSettingsService);
        let cancelled = false;
        (component as unknown as { thanos: unknown }).thanos = {
          vaporize$: () =>
            new Observable<void>(() => () => {
              cancelled = true;
            }),
        };

        component['flow'].resetGame();
        expect(component['flow'].resetting()).toBe(true);

        jest.advanceTimersByTime(settings.value('vaporizeMs') + 5_000 - 1);
        expect(cancelled).toBe(false);
        jest.advanceTimersByTime(2);

        expect(cancelled).toBe(true);
        expect(component['flow'].resetting()).toBe(false);
        expect(store.snapshot().currentState).toBe(GameState.START);
      } finally {
        jest.useRealTimers();
      }
    });

    it('frees the stage even when clearing the arena fails', () => {
      create();
      startMatch('vs-computer');
      jest
        .spyOn(TestBed.inject(GameStateService), 'reset')
        .mockImplementation(() => {
          throw new Error('no GPU');
        });
      const vaporized = new Subject<void>();
      (component as unknown as { thanos: unknown }).thanos = {
        vaporize$: () => vaporized,
      };
      const error = jest.fn();

      component['flow'].resetGame$().subscribe({ error });
      vaporized.complete();

      expect(component['flow'].resetting()).toBe(false);
      expect(error).toHaveBeenCalledWith(expect.any(Error));
    });

    it('frees the stage when the effect fails before it even starts', () => {
      create();
      startMatch('vs-computer');
      const consoleError = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      try {
        (component as unknown as { thanos: unknown }).thanos = {
          vaporize$: () => {
            throw new Error('no context');
          },
        };

        component['flow'].resetGame();

        expect(component['flow'].resetting()).toBe(false);
        expect(store.snapshot().currentState).toBe(GameState.START);
        expect(consoleError).toHaveBeenCalledWith(
          'The arena could not be vaporized',
          expect.any(Error)
        );
      } finally {
        consoleError.mockRestore();
      }
    });

    /**
     * The stage after the effect waits for its own render, so these tests
     * render the template - the one place in this file that does. jsdom has
     * no `ResizeObserver` and draws on no canvas: the arena gets a painter
     * that paints nothing, the other canvases a context of null, which they
     * take.
     */
    describe('the hidden arena', () => {
      let getContext: jest.SpyInstance;

      beforeEach(() => {
        Object.assign(globalThis, {
          ResizeObserver: class {
            observe(): void {}
            unobserve(): void {}
            disconnect(): void {}
          },
        });
        getContext = jest
          .spyOn(HTMLCanvasElement.prototype, 'getContext')
          .mockImplementation(() => null);
      });

      afterEach(() => {
        getContext.mockRestore();
        delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
      });

      /**
       * Runs a match through the vaporize effect to its end, with the arena
       * frame wired up by hand, and gives back that frame along with the two
       * events it waits for: the stage rendering what follows (a change
       * detection, which runs the after-render hooks) and the arena painting
       * its next frame.
       */
      function vaporizedArena(): {
        div: HTMLDivElement;
        render: () => void;
        paint: () => void;
      } {
        const painter: ArenaPainter = {
          kind: 'canvas',
          setFloor: () => undefined,
          paint: () => undefined,
          showLastFrame: () => undefined,
          dispose: () => undefined,
        };
        create(false, true, true, [
          { provide: ARENA_PAINTER_FACTORY, useValue: () => painter },
        ]);
        startMatch('vs-computer');
        const div = document.createElement('div');
        (component as unknown as { arenaFrame: () => unknown }).arenaFrame =
          () => ({ nativeElement: div });
        const vaporized = new Subject<void>();
        (component as unknown as { thanos: unknown }).thanos = {
          vaporize$: () => vaporized,
        };

        component['flow'].resetGame();
        expect(div.style.visibility).toBe('');
        vaporized.complete();
        expect(div.style.visibility).toBe('hidden');

        const frame = {
          view: { x: 0, y: 0, width: 320, height: 140 },
          dynamicWalls: [],
          deltaTimeSec: 0,
        } as unknown as ArenaFrame;
        return {
          div,
          render: () => fixture.detectChanges(),
          paint: () => component['stageFrame'].scene.painted?.(frame),
        };
      }

      it('stays out of sight after the effect until the stage rendered and the next frame is painted', () => {
        const { div, render, paint } = vaporizedArena();

        paint();
        expect(div.style.visibility).toBe('hidden');

        render();

        expect(div.style.visibility).toBe('');
      });

      it('stays out of sight until the frame painted after the stage rendered', () => {
        const { div, render, paint } = vaporizedArena();

        render();
        expect(div.style.visibility).toBe('hidden');

        paint();

        expect(div.style.visibility).toBe('');
      });
    });

    it('speaks German once the player picks it', () => {
      create();
      TestBed.inject(GameStateService).setDifficulty('hard');
      expect(component['hud'].clockLabel()).toBe('Game time');

      TestBed.inject(I18nService).setLanguage('de');

      expect(component['hud'].clockLabel()).toBe('Spielzeit');
      expect(component['hud'].difficultyName()).toBe('Schwer');
      expect(component['flow'].settingsBackLabel()).toBe('Menü');
    });
  });

  describe('a new game', () => {
    it('opens on the mode last played, and its levels after a match', () => {
      create();
      component['flow'].setPlayKind('free');

      component['flow'].openNewGame();
      expect(component['flow'].panel()).toBe('new-game');
      expect(component['flow'].newGameEntry()).toEqual({
        kind: 'free',
        step: 'mode',
      });

      component['matchEnd'].onMatchEnd('levels');
      expect(component['flow'].newGameEntry()).toEqual({
        kind: 'free',
        step: 'level',
      });
    });

    it('opens the daily level, which has no level to choose, on its mode', () => {
      create();
      component['flow'].setPlayKind('daily');

      component['matchEnd'].onMatchEnd('levels');

      expect(component['flow'].newGameEntry()).toEqual({
        kind: 'daily',
        step: 'mode',
      });
    });
  });

  describe('the campaign ladder', () => {
    it('marks the levels the ladder has not opened', () => {
      create();
      TestBed.inject(GameStateService).setMode('vs-computer');

      expect(TestBed.inject(CampaignService).locks()[LEVELS[2].id]).toBe(
        `Win ${levelTitle(LEVELS[1])} to unlock`
      );
      expect(LEVELS[0].id in TestBed.inject(CampaignService).locks()).toBe(
        false
      );
    });

    it('locks the next level on the result screen until it is open', () => {
      create();
      startMatch('vs-computer');
      const before = store.snapshot().levelId;
      store.update({ endedBy: 'annihilation' });

      expect(component['hud'].upcomingLock()).toBe(
        `Win ${levelTitle(LEVELS[0])} to unlock`
      );
      component['matchEnd'].onMatchEnd('next');
      expect(store.snapshot().levelId).toBe(before);
    });
  });

  describe('the arena', () => {
    it('draws a level in an arena the player earned, in its own otherwise', () => {
      create();
      const settings = TestBed.inject(GameSettingsService);
      const own = component['arenaStage'].theme();

      settings.set('arena', LEVELS[2].id);
      expect(component['arenaStage'].theme()).toEqual(own);

      localStorage.setItem(
        PROGRESS_STORAGE_KEY,
        JSON.stringify({ medals: { [LEVELS[2].id]: { easy: 'gold' } } })
      );
      create();
      TestBed.inject(GameSettingsService).set('arena', LEVELS[2].id);
      expect(component['arenaStage'].theme()).toEqual(arenaTheme(LEVELS[2].id));
    });
  });
});
