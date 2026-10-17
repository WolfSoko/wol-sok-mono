/**
 * Thin, testable wrapper around the Fullscreen API.
 *
 * Safari still only knows the prefixed calls, so every entry point falls back
 * to the `webkit` variants. The helpers take the document and the element as
 * arguments instead of reaching for the globals, which keeps them free of the
 * DOM in tests.
 */

/** The part of an element the fullscreen helpers use. */
export interface FullscreenElement {
  requestFullscreen?: () => Promise<void>;
  webkitRequestFullscreen?: () => Promise<void> | void;
}

/** The part of a document the fullscreen helpers use. */
export interface FullscreenDocument {
  fullscreenEnabled?: boolean;
  webkitFullscreenEnabled?: boolean;
  fullscreenElement?: Element | null;
  webkitFullscreenElement?: Element | null;
  exitFullscreen?: () => Promise<void>;
  webkitExitFullscreen?: () => Promise<void> | void;
}

/** The element that currently fills the screen, or null when none does. */
export function fullscreenElementOf(
  doc: FullscreenDocument
): Element | null | undefined {
  return doc.fullscreenElement ?? doc.webkitFullscreenElement;
}

/** True while this element - or any element, without one - fills the screen. */
export function isFullscreen(
  doc: FullscreenDocument,
  element?: unknown
): boolean {
  const current = fullscreenElementOf(doc);
  if (current == null) {
    return false;
  }
  return element == null || current === element;
}

/** True when the browser lets this page go fullscreen at all. */
export function isFullscreenSupported(
  doc: FullscreenDocument,
  element: FullscreenElement | null | undefined
): boolean {
  if (element == null) {
    return false;
  }
  const enabled = doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled ?? false;
  const requestable =
    element.requestFullscreen != null ||
    element.webkitRequestFullscreen != null;
  return enabled && requestable;
}

/**
 * Takes whatever fills the screen off it again. Returns whether a call was
 * made at all.
 */
export function exitFullscreen(doc: FullscreenDocument): boolean {
  if (!isFullscreen(doc)) {
    return false;
  }
  const exit = doc.exitFullscreen ?? doc.webkitExitFullscreen;
  if (exit == null) {
    return false;
  }
  void Promise.resolve(exit.call(doc)).catch(() => undefined);
  return true;
}

/**
 * Asks the browser to put the element on the whole screen.
 *
 * Resolves to whether the element fills the screen once the request has
 * settled. The browser refuses a request that does not come from a user
 * gesture, and the API is missing altogether on iPhones; the caller then
 * keeps its own full-viewport layout and may try again on the next gesture.
 *
 * The answer is read from the document rather than from the request: the
 * prefixed Safari call returns nothing and reports a refusal only as an
 * event, so its empty return must not count as granted.
 */
export function requestFullscreen(
  doc: FullscreenDocument,
  element: FullscreenElement | null | undefined
): Promise<boolean> {
  const request =
    element?.requestFullscreen ?? element?.webkitRequestFullscreen;
  if (element == null || request == null) {
    return Promise.resolve(false);
  }
  const granted = () => isFullscreen(doc, element);
  try {
    return Promise.resolve(request.call(element)).then(granted, () => false);
  } catch {
    return Promise.resolve(false);
  }
}

/** The part of `navigator` the activation check uses. */
export interface ActivationNavigator {
  userActivation?: { isActive?: boolean };
}

/**
 * True while the page may still spend a recent user gesture, for instance
 * right after a navigation started by a click. A fullscreen request stands a
 * chance then and is wasted otherwise - the browser refuses it and logs an
 * error. Browsers without the API report false, and the request waits for
 * the next gesture.
 */
export function hasUserActivation(
  nav: ActivationNavigator | undefined
): boolean {
  return nav?.userActivation?.isActive === true;
}

/** The part of `screen.orientation` the lock helpers use. */
export interface OrientationLockScreen {
  orientation?: {
    lock?: (orientation: 'landscape') => Promise<void>;
    unlock?: () => void;
  };
}

/**
 * Keeps a phone in landscape while the arena fills its screen - the arena is
 * more than twice as wide as it is tall, and two players sit along its long
 * edges. Browsers only honour the lock in fullscreen, and desktops reject it;
 * both are fine, so the failure is swallowed.
 */
export function lockLandscape(screen: OrientationLockScreen | undefined): void {
  const lock = screen?.orientation?.lock;
  if (lock == null) {
    return;
  }
  try {
    void Promise.resolve(lock.call(screen?.orientation, 'landscape')).catch(
      () => undefined
    );
  } catch {
    // Some browsers throw synchronously instead of rejecting.
  }
}

/** Lets the phone rotate freely again. */
export function unlockOrientation(
  screen: OrientationLockScreen | undefined
): void {
  try {
    screen?.orientation?.unlock?.();
  } catch {
    // Not locked, or not supported - nothing to undo either way.
  }
}

/** A width and a height in CSS pixels. */
export interface Size {
  width: number;
  height: number;
}

/**
 * The largest size with the arena's aspect ratio that still fits into the
 * given box.
 *
 * The canvas element itself is sized to it rather than letting CSS letterbox
 * the drawing inside a larger element: the pointer maths maps a touch through
 * the bounding rect of the canvas, and padding hidden inside that rect would
 * offset every crosshair drag.
 */
export function fitInside(
  outerWidth: number,
  outerHeight: number,
  arenaWidth: number,
  arenaHeight: number
): Size | null {
  if (
    outerWidth <= 0 ||
    outerHeight <= 0 ||
    arenaWidth <= 0 ||
    arenaHeight <= 0
  ) {
    return null;
  }
  const scale = Math.min(outerWidth / arenaWidth, outerHeight / arenaHeight);
  return {
    width: Math.max(1, Math.floor(arenaWidth * scale)),
    height: Math.max(1, Math.floor(arenaHeight * scale)),
  };
}
