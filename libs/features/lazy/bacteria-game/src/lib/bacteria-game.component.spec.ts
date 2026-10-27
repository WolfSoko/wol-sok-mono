import { StageBusy } from './busy/stage-busy';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Subject } from 'rxjs';
import { arenaTheme } from './arena/arena-theme';
import { BacteriaGameComponent } from './bacteria-game.component';
import { I18nService } from './i18n/i18n.service';
import { MatchmakerService } from './net/matchmaker.service';
import { PROGRESS_STORAGE_KEY } from './progress.service';
import { GameSettingsService } from './settings.service';
import { GameSoundService } from './sound/game-sound.service';
import { GameStateService } from './state/game-state.service';
import { GameStateStore } from './state/game.states';
import { levelTitle, LEVELS } from './state/levels';
import { MATCH_LEVELS } from './state/match-level';
import { PlayerStore } from './state/player.store';
import { replayOf } from './state/replay';

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
 * Lets the page believe it runs on a touch device, which opens the game
 * fullscreen, or on a desktop, which opens it embedded in the page.
 */
function stubTouch(touch: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    value: (query: string) => ({
      matches: touch && query === '(pointer: coarse)',
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }),
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
  let store: GameStateStore;

  /**
   * Creates the component with a stage whose fullscreen request the browser
   * grants or refuses, and returns that stage. The template is not rendered,
   * so the stage element is wired up by hand. Unless told otherwise, the
   * page runs on a touch device and so opens fullscreen.
   */
  function create(granted = false, touch = true) {
    stubTouch(touch);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [BacteriaGameComponent, NoopAnimationsModule],
    });
    store = TestBed.inject(GameStateStore);
    fixture = TestBed.createComponent(BacteriaGameComponent);
    component = fixture.componentInstance;
    const arena = stage(granted);
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

  describe('the F shortcut', () => {
    it('goes fullscreen for a key pressed in the arena', () => {
      const arena = create();
      component['fullscreen'].set(false);

      component.onKeyDown(keyEvent('f', document.body));

      expect(component['fullscreen']()).toBe(true);
      expect(arena.requestFullscreen).toHaveBeenCalled();
      expect(store.snapshot().keysPressed).not.toContain('f');
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
        TestBed.inject(PlayerStore).entityMap()[playerId]?.boostActiveSec ?? 0
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
      expect(store.snapshot().keysPressed).not.toContain(' ');
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
    it('opens fullscreen on a touch device', () => {
      create();

      expect(component['fullscreen']()).toBe(true);
    });

    it('opens embedded in the page on a desktop, on the main menu', () => {
      const arena = create(false, false);

      expect(component['fullscreen']()).toBe(false);
      expect(component['panel']()).toBe('menu');
      expect(component['screenOpen']()).toBe(true);

      component.startGame();
      expect(arena.requestFullscreen).not.toHaveBeenCalled();
    });

    it('fills the viewport below what is above the embedded stage', () => {
      create(false, false);
      (component as unknown as { stageRef: unknown }).stageRef = {
        nativeElement: { getBoundingClientRect: () => ({ top: 64.4 }) },
      };

      component['measureStageTop']();

      expect(component['stageTop']()).toBe(64);
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

  describe('the fullscreen buttons', () => {
    it('toggle between the page and the whole screen', () => {
      const arena = create(false, false);

      component['setFullscreen'](true);
      expect(component['fullscreen']()).toBe(true);
      expect(arena.requestFullscreen).toHaveBeenCalledTimes(1);

      component['setFullscreen'](false);
      expect(component['fullscreen']()).toBe(false);
    });
  });

  describe('leaving fullscreen', () => {
    it('puts the stage back into the page and gives the screen back', () => {
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
      expect(store.snapshot().keysPressed).not.toContain('Escape');
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

    it('takes no key while the work of a tap waits to run', () => {
      create();
      component['show']('new-game');

      TestBed.inject(StageBusy).run(() => undefined);
      component.onKeyDown(keyEvent('Escape', document.body));

      expect(component['panel']()).toBe('new-game');
    });

    it('leaves fullscreen on Escape from the main menu only', () => {
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

      store.update({ endedBy: 'annihilation' });

      expect(component['panel']()).toBe('over');
    });

    it('switches to the next level only once the old arena is vaporized', () => {
      storeWin(LEVELS[0].id);
      create();
      startMatch('vs-computer');
      const vaporized = new Subject<void>();
      (component as unknown as { thanos: unknown }).thanos = {
        vaporize: () => vaporized,
      };
      const before = store.snapshot().levelId;
      store.update({ endedBy: 'annihilation' });

      component['onMatchEnd']('next');
      expect(store.snapshot().levelId).toBe(before);

      vaporized.complete();
      expect(store.snapshot().levelId).not.toBe(before);
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

    it('speaks German once the player picks it', () => {
      create();
      TestBed.inject(GameStateService).setDifficulty('hard');
      expect(component['clockLabel']()).toBe('Game time');

      TestBed.inject(I18nService).setLanguage('de');

      expect(component['clockLabel']()).toBe('Spielzeit');
      expect(component['difficultyName']()).toBe('Schwer');
      expect(component['settingsBackLabel']()).toBe('Menü');
    });
  });

  describe('the vaporize effect', () => {
    it('snaps only while the sound and the effects are on', () => {
      create();
      const settings = TestBed.inject(GameSettingsService);

      expect(component['thanosOptions']().sound).toBe(true);
      settings.setSound(false);
      expect(component['thanosOptions']().sound).toBe(false);
      settings.setSound(true);
      settings.setEffects(false);
      expect(component['thanosOptions']().sound).toBe(false);
    });

    it('snaps as loud as the other effects', () => {
      create();
      const settings = TestBed.inject(GameSettingsService);
      const louder = () => component['thanosOptions']().soundVolume ?? 0;

      const atDefault = louder();
      settings.setEffectsVolume(40);

      expect(louder()).toBeLessThan(atDefault);
      expect(louder()).toBeCloseTo(
        TestBed.inject(GameSoundService).effectsGain() * 0.3
      );
    });

    it('takes as long as set', () => {
      create();
      const settings = TestBed.inject(GameSettingsService);

      expect(component['thanosOptions']().animationLength).toBe(2500);
      settings.setVaporizeMs(5000);
      expect(component['thanosOptions']().animationLength).toBe(5000);
    });

    it('captures the arena within the pixel budget of the quality', () => {
      create();
      const settings = TestBed.inject(GameSettingsService);
      const pixels = () => component['thanosOptions']().maxCapturePixels;

      expect(pixels()).toBe(500_000);
      settings.setVaporize('low');
      expect(pixels()).toBe(250_000);
      settings.setVaporize('full');
      expect(pixels()).toBeUndefined();
    });

    it('simply clears the arena while the effect is off', async () => {
      create();
      TestBed.inject(GameSettingsService).setVaporize('off');
      const vaporize = jest.fn(() => new Subject<void>());
      (component as unknown as { thanos: unknown }).thanos = { vaporize };
      const done = jest.fn();

      component['vaporize']().subscribe({ complete: done });
      // Like the effect, it is over only after the caller is through.
      expect(done).not.toHaveBeenCalled();
      await Promise.resolve();

      expect(vaporize).not.toHaveBeenCalled();
      expect(done).toHaveBeenCalled();
    });
  });

  describe('a new game', () => {
    it('sets the game up for the mode picked', () => {
      create();
      const settings = TestBed.inject(GameSettingsService);

      component['setPlayKind']('two-players');
      expect(store.snapshot().mode).toBe('two-players');

      component['setPlayKind']('free');
      expect(store.snapshot().mode).toBe('vs-computer');
      expect(settings.freePlay()).toBe(true);

      component['setPlayKind']('campaign');
      expect(settings.freePlay()).toBe(false);
    });

    it('opens on the mode last played, and its levels after a match', () => {
      create();
      component['setPlayKind']('free');

      component['openNewGame']();
      expect(component['panel']()).toBe('new-game');
      expect(component['newGameEntry']()).toEqual({
        kind: 'free',
        step: 'mode',
      });

      component['onMatchEnd']('levels');
      expect(component['newGameEntry']()).toEqual({
        kind: 'free',
        step: 'level',
      });
    });

    it('opens the daily level, which has no level to choose, on its mode', () => {
      create();
      component['setPlayKind']('daily');

      component['onMatchEnd']('levels');

      expect(component['newGameEntry']()).toEqual({
        kind: 'daily',
        step: 'mode',
      });
    });
  });

  describe('the campaign ladder', () => {
    it('marks the levels the ladder has not opened', () => {
      create();
      TestBed.inject(GameStateService).setMode('vs-computer');

      expect(component['lockedLevels']()[LEVELS[2].id]).toBe(
        `Win ${levelTitle(LEVELS[1])} to unlock`
      );
      expect(LEVELS[0].id in component['lockedLevels']()).toBe(false);
    });

    it('locks the next level on the result screen until it is open', () => {
      create();
      startMatch('vs-computer');
      const before = store.snapshot().levelId;
      store.update({ endedBy: 'annihilation' });

      expect(component['upcomingLock']()).toBe(
        `Win ${levelTitle(LEVELS[0])} to unlock`
      );
      component['onMatchEnd']('next');
      expect(store.snapshot().levelId).toBe(before);
    });
  });

  describe('the arena', () => {
    it('draws a level in an arena the player earned, in its own otherwise', () => {
      create();
      const settings = TestBed.inject(GameSettingsService);
      const own = component['theme']();

      settings.setArena(LEVELS[2].id);
      expect(component['theme']()).toEqual(own);

      localStorage.setItem(
        PROGRESS_STORAGE_KEY,
        JSON.stringify({ medals: { [LEVELS[2].id]: { easy: 'gold' } } })
      );
      create();
      TestBed.inject(GameSettingsService).setArena(LEVELS[2].id);
      expect(component['theme']()).toEqual(arenaTheme(LEVELS[2].id));
    });
  });

  describe('the colony colours', () => {
    it('keeps a colour still to earn from either seat, also by a swap', () => {
      create();
      const gameState = TestBed.inject(GameStateService);
      gameState.setMode('two-players');
      // Settings from before the lock: the right seat plays green.
      gameState.setColors(['orange', 'green']);

      component['selectColor']({ seat: 0, colorId: 'green' });
      expect(store.snapshot().colors).toEqual(['orange', 'green']);

      component['selectColor']({ seat: 1, colorId: 'orange' });
      expect(store.snapshot().colors).toEqual(['orange', 'green']);

      component['selectColor']({ seat: 1, colorId: 'blue' });
      expect(store.snapshot().colors).toEqual(['orange', 'blue']);
    });
  });

  describe('a shared run', () => {
    const run = replayOf(
      {
        levelId: LEVELS[3].id,
        mode: 'vs-computer',
        difficulty: 'normal',
        colors: ['orange', 'blue'],
        headStart: 0,
        width: 320,
        height: 140,
        seed: 9,
      },
      'cpu',
      600,
      { steers: [[0, 0, 1, 0]], drags: [], boosts: [], weapons: [] }
    );

    it('starts a match against it on Fight it', async () => {
      create();
      store.update({ challenge: run });

      const held = holdBusyWork();
      component['fightChallenge']();
      await held[0]();

      expect(store.ghost()).toEqual(run);
      expect(store.challenge()).toBeNull();
      expect(store.level().id).toBe(LEVELS[3].id);
      expect(TestBed.inject(PlayerStore).entities()[1].name).toBe('Ghost');
    });

    it('lets it go on Not now', () => {
      create();
      store.update({ challenge: run });

      component['dismissChallenge']();

      expect(store.challenge()).toBeNull();
      expect(store.ghost()).toBeNull();
    });
  });

  /**
   * Holds the work a tap sets off behind the spinner, rather than waiting
   * out the frame (which would render the template these specs leave out).
   */
  function holdBusyWork(): Array<() => void | Promise<unknown>> {
    const held: Array<() => void | Promise<unknown>> = [];
    jest
      .spyOn(TestBed.inject(StageBusy), 'run')
      .mockImplementation((work) => held.push(work));
    return held;
  }

  describe('a match started from a tap', () => {
    it('takes the screen on the tap, and sets the match up behind the spinner', async () => {
      create();
      const held = holdBusyWork();
      const fullscreen = jest
        .spyOn(component as never, 'requestNativeFullscreen')
        .mockImplementation(() => undefined);
      const start = jest
        .spyOn(component, 'startGame')
        .mockImplementation(() => undefined);

      component['startNewGame']('campaign');

      expect(fullscreen).toHaveBeenCalled();
      expect(start).not.toHaveBeenCalled();
      await held[0]();
      expect(start).toHaveBeenCalledTimes(1);
    });

    it('stays busy until a daily match is under way', async () => {
      create();
      const held = holdBusyWork();
      let started = (): void => undefined;
      jest
        .spyOn(component as never, 'playDaily')
        .mockImplementation(
          (() => new Promise<void>((resolve) => (started = resolve))) as never
        );

      component['startNewGame']('daily');
      let done = false;
      const work = Promise.resolve(held[0]()).then(() => (done = true));
      await Promise.resolve();

      expect(done).toBe(false);
      started();
      await work;
      expect(done).toBe(true);
    });
  });

  describe('a match the matchmaking set up', () => {
    it('is played on the level the matchmaking picked', () => {
      create();
      const levelId = MATCH_LEVELS[3].id;
      jest
        .spyOn(TestBed.inject(MatchmakerService), 'matchLevel')
        .mockReturnValue({ levelId, reason: 'theirs' });
      const start = jest
        .spyOn(component as unknown as { startGame(): void }, 'startGame')
        .mockImplementation(() => undefined);

      (
        component as unknown as { startMatchmadeMatch(): void }
      ).startMatchmadeMatch();

      expect(store.snapshot().levelId).toBe(levelId);
      expect(start).toHaveBeenCalled();
    });
  });

  describe('giving a ranked match up', () => {
    function armed() {
      create();
      return jest
        .spyOn(component as never, 'quitToMenu')
        .mockImplementation(() => undefined);
    }

    it('quits on the second tap only, while the first is armed', () => {
      const quit = armed();

      component['giveUp']();
      expect(component['giveUpArmed']()).toBe(true);
      expect(quit).not.toHaveBeenCalled();

      component['giveUp']();
      expect(quit).toHaveBeenCalledTimes(1);
      expect(component['giveUpArmed']()).toBe(false);
    });

    it('disarms by itself after a while', () => {
      const quit = armed();
      const timers = jest.spyOn(globalThis, 'setTimeout');

      component['giveUp']();
      const [disarm, ms] = timers.mock.calls.at(-1) ?? [];
      expect(ms).toBe(3_000);
      (disarm as () => void)();
      expect(component['giveUpArmed']()).toBe(false);

      component['giveUp']();
      expect(quit).not.toHaveBeenCalled();
      timers.mockRestore();
    });
  });

  describe('the joysticks', () => {
    it('steer the crosshair of their player', () => {
      create();
      const playerStore = startMatch('two-players');
      const before = playerStore.entityMap()[1]?.x ?? 0;

      component['steer'](1, { x: 1, y: 0 });
      TestBed.inject(GameStateService).advance(320, 140, 3);

      expect(playerStore.entityMap()[1]?.x).toBeGreaterThan(before);
      expect(playerStore.entityMap()[0]?.x).toBe(80);
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
