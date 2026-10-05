/**
 * How long the browser may take to turn a lifted finger into a click. It
 * fires one a moment after the touch ends, at the point the finger was -
 * which by then is the backdrop of the menu the long press has just opened.
 */
export const SYNTHETIC_CLICK_MS = 700;

/**
 * Eats the one click a lifted finger is turned into. It lands where the
 * finger was, which by then may be under the panel the long press has just
 * opened - on a slider, or on the button that closes it again. Nothing else
 * is swallowed: the listener gives up on the first click, or after the
 * browser can no longer be sending that one.
 */
export function swallowNextClick(): void {
  const swallow = (event: MouseEvent): void => {
    event.stopPropagation();
    event.preventDefault();
    stop();
  };
  // both close over `timer`, which is set by the time either of them runs
  const stop = (): void => {
    document.removeEventListener('click', swallow, true);
    clearTimeout(timer);
  };
  const timer: ReturnType<typeof setTimeout> = setTimeout(
    stop,
    SYNTHETIC_CLICK_MS
  );
  document.addEventListener('click', swallow, true);
}
