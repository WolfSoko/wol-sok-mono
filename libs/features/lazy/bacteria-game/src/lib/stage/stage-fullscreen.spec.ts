import { TestBed } from '@angular/core/testing';
import {
  settle,
  stubActivation,
  stubFullscreen,
  StubStage,
  stubStage,
  stubTouch,
} from '../../testing/fullscreen-stubs';
import { StageFullscreen } from './stage-fullscreen';

describe('StageFullscreen', () => {
  let fullscreen: StageFullscreen;

  /**
   * Creates the service over a stage whose fullscreen request the browser
   * grants or refuses, and returns that stage. Unless told otherwise, the
   * page runs on a touch device and so opens fullscreen.
   */
  function create(granted = false, touch = true): StubStage {
    stubTouch(touch);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [StageFullscreen] });
    fullscreen = TestBed.inject(StageFullscreen);
    const arena = stubStage(granted);
    fullscreen.bind(() => arena as unknown as HTMLElement);
    return arena;
  }

  beforeEach(() => {
    stubFullscreen(null);
    stubActivation(false);
  });

  describe('entering the page', () => {
    it('opens fullscreen on a touch device', () => {
      create();

      expect(fullscreen.fullscreen()).toBe(true);
    });

    it('opens embedded in the page on a desktop', () => {
      create(false, false);

      expect(fullscreen.fullscreen()).toBe(false);
    });

    it('fills the viewport below what is above the embedded stage', () => {
      create(false, false);
      fullscreen.bind(
        () =>
          ({
            getBoundingClientRect: () => ({ top: 64.4 }),
          }) as unknown as HTMLElement
      );

      fullscreen.measureStageTop();

      expect(fullscreen.stageTop()).toBe(64);
    });

    it('does not waste the native request on a page opened without a gesture', () => {
      const arena = create();

      fullscreen.open();

      expect(arena.requestFullscreen).not.toHaveBeenCalled();
    });

    it('spends the gesture of the navigation that opened the page', () => {
      const arena = create(true);
      stubActivation(true);

      fullscreen.open();

      expect(arena.requestFullscreen).toHaveBeenCalledTimes(1);
    });

    it('asks again with the next gesture once the browser refused', async () => {
      const arena = create();
      fullscreen.requestNative();
      await settle();

      fullscreen.requestNative();

      expect(arena.requestFullscreen).toHaveBeenCalledTimes(2);
    });

    it('stops asking once the browser granted it', async () => {
      const arena = create(true);
      fullscreen.requestNative();
      await settle();

      fullscreen.requestNative();

      expect(arena.requestFullscreen).toHaveBeenCalledTimes(1);
    });

    it('does not ask at all without the API, as on an iPhone', () => {
      create();
      Object.defineProperty(document, 'fullscreenEnabled', {
        value: undefined,
        configurable: true,
      });

      expect(() => fullscreen.requestNative()).not.toThrow();
      expect(fullscreen.fullscreen()).toBe(true);
    });
  });

  describe('the fullscreen buttons', () => {
    it('toggle between the page and the whole screen', () => {
      const arena = create(false, false);

      fullscreen.set(true);
      expect(fullscreen.fullscreen()).toBe(true);
      expect(arena.requestFullscreen).toHaveBeenCalledTimes(1);

      fullscreen.set(false);
      expect(fullscreen.fullscreen()).toBe(false);
    });
  });

  describe('leaving fullscreen', () => {
    it('puts the stage back into the page and gives the screen back', () => {
      const arena = create(true);
      const exit = stubFullscreen(arena as unknown as Element);

      fullscreen.leave();

      expect(fullscreen.fullscreen()).toBe(false);
      expect(exit).toHaveBeenCalled();
    });

    it('does not pull the player back in with the next gesture', () => {
      const arena = create();
      fullscreen.leave();

      fullscreen.requestNative();

      expect(arena.requestFullscreen).not.toHaveBeenCalled();
    });

    it('gives the screen back as the stage goes', () => {
      const arena = create(true);
      const exit = stubFullscreen(arena as unknown as Element);

      fullscreen.release();

      expect(exit).toHaveBeenCalled();
    });
  });

  describe('following the browser', () => {
    /** A player inside the stage, which takes the screen for itself. */
    function playerInside(arena: StubStage): Element {
      const player = document.createElement('div');
      arena.contains = (node) => node === player;
      return player;
    }

    it('tells when the browser took the screen off the stage', () => {
      const arena = create();
      stubFullscreen(arena as unknown as Element);
      expect(fullscreen.followBrowser()).toBe(false);
      expect(fullscreen.nativeFullscreen()).toBe(true);

      stubFullscreen(null);

      expect(fullscreen.followBrowser()).toBe(true);
      expect(fullscreen.nativeFullscreen()).toBe(false);
    });

    it('lets a replay player inside the stage take the screen without changing the stage', () => {
      const arena = create();
      const player = playerInside(arena);

      stubFullscreen(player);
      expect(fullscreen.followBrowser()).toBe(false);

      expect(fullscreen.nativeFullscreen()).toBe(false);
      expect(fullscreen.fullscreen()).toBe(true);

      // The player closed while on the screen: the browser gives it back,
      // but it never was the stage's, so the layout stays.
      stubFullscreen(null);

      expect(fullscreen.followBrowser()).toBe(false);
      expect(fullscreen.fullscreen()).toBe(true);
    });

    it('follows the browser into a fullscreen granted after the layout was left', () => {
      const arena = create(true);
      fullscreen.leave();
      stubFullscreen(arena as unknown as Element);

      fullscreen.followBrowser();

      expect(fullscreen.fullscreen()).toBe(true);
    });
  });
});
