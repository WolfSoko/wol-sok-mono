/**
 * Stand-ins for the browser's Fullscreen API, user activation and pointer
 * kind, for the specs of the stage and its fullscreen. jsdom has none of
 * them.
 */

/**
 * Lets the helpers believe the browser offers the API and that the given
 * element is on the screen.
 */
export function stubFullscreen(element: Element | null): jest.Mock {
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
export function stubActivation(isActive: boolean): void {
  Object.defineProperty(navigator, 'userActivation', {
    value: { isActive },
    configurable: true,
  });
}

/**
 * Lets the page believe it runs on a touch device, which opens the game
 * fullscreen, or on a desktop, which opens it embedded in the page.
 */
export function stubTouch(touch: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    value: (query: string) => ({
      matches: touch && query === '(pointer: coarse)',
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      // The CDK's breakpoint observer (behind Material's high-contrast
      // detection) still listens the old way.
      addListener: jest.fn(),
      removeListener: jest.fn(),
    }),
    configurable: true,
  });
}

/** A stage element whose fullscreen request the browser grants or refuses. */
export interface StubStage {
  requestFullscreen: jest.Mock<Promise<void>, []>;
  /** Nothing sits inside the bare stage until a test puts something there. */
  contains: (node: Node) => boolean;
}

/**
 * A stage whose fullscreen request the browser grants or refuses. A granted
 * request puts the stage on the screen, as the browser would.
 */
export function stubStage(granted: boolean): StubStage {
  const arena: StubStage = {
    requestFullscreen: jest.fn(() => {
      if (!granted) {
        return Promise.reject(new TypeError('no gesture'));
      }
      stubFullscreen(arena as unknown as Element);
      return Promise.resolve();
    }),
    contains: () => false,
  };
  return arena;
}

/**
 * Lets the fullscreen request settle. Microtasks only: a timer would run the
 * change detection, which renders the canvas that jsdom cannot draw on.
 */
export async function settle(): Promise<void> {
  for (let hop = 0; hop < 5; hop++) {
    await Promise.resolve();
  }
}

/** A key event as the document hands it on, with its target. */
export function keyEvent(
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
