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
 * Asks the browser to put the element on the whole screen, and settles once
 * the browser has answered.
 *
 * Whether it granted the request is not reported here but by the document:
 * the `fullscreenchange` event, which fires for every way in and out. The
 * browser refuses a request that does not come from a user gesture, and the
 * API is missing altogether on iPhones; the caller then keeps its own
 * full-viewport layout and asks again with the next gesture. The call itself
 * happens synchronously, inside the gesture that triggered it.
 */
export async function requestFullscreen(
  element: FullscreenElement | null | undefined
): Promise<void> {
  const request =
    element?.requestFullscreen ?? element?.webkitRequestFullscreen;
  if (element == null || request == null) {
    return;
  }
  try {
    await request.call(element);
  } catch {
    // Refused: no gesture to spend, or a policy against it.
  }
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
export async function lockLandscape(
  screen: OrientationLockScreen
): Promise<void> {
  const orientation = screen.orientation;
  if (orientation?.lock == null) {
    return;
  }
  try {
    await orientation.lock('landscape');
  } catch {
    // Not in fullscreen, or a screen that does not turn.
  }
}

/** Lets the phone rotate freely again. */
export function unlockOrientation(screen: OrientationLockScreen): void {
  try {
    screen.orientation?.unlock?.();
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
