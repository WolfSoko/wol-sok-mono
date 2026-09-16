import { ClientPoint, clientPoint } from '../camera/world-camera';

/** How far the cursor may travel between press and release to still be a click. */
export const CLICK_TOLERANCE_PX = 4;
/** How long a touch has to rest on an object to open its menu. */
export const LONG_PRESS_MS = 450;

/** Whether two client positions are close enough to be the same spot. */
export function isWithinClickTolerance(
  a: ClientPoint,
  b: ClientPoint
): boolean {
  return (
    Math.abs(a.clientX - b.clientX) <= CLICK_TOLERANCE_PX &&
    Math.abs(a.clientY - b.clientY) <= CLICK_TOLERANCE_PX
  );
}

/**
 * The pointers on the world and what they went down on: how many there are,
 * where they are, whether one of them is still resting on the spot it started
 * at, and whether it has rested there long enough to count as a long press.
 *
 * Raw pointers in, gestures out. What a gesture then means - a tap, a throw,
 * an orbit - is for whoever is holding the tracker to decide; it is `T` here
 * and nothing more.
 */
export class PointerTracker<T> {
  private readonly active = new Map<number, ClientPoint>();
  private press: { subject: T; at: ClientPoint } | null = null;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;

  /** How many pointers are down on the world right now. */
  get count(): number {
    return this.active.size;
  }

  /**
   * The two pointers of a two finger gesture, and only when there are exactly
   * two of them: three fingers are not a pinch, and handing out the first two
   * of them would turn one into a pinch its owner never asked for.
   */
  get pair(): readonly [ClientPoint, ClientPoint] | null {
    if (this.active.size !== 2) {
      return null;
    }
    const [first, second] = [...this.active.values()];
    return first && second ? [first, second] : null;
  }

  /** Takes note of a pointer that has just gone down. */
  add(pointerId: number, at: ClientPoint): void {
    this.active.set(pointerId, clientPoint(at));
  }

  /** Moves a pointer that is down; one that is not is left alone. */
  moveTo(pointerId: number, at: ClientPoint): void {
    if (this.active.has(pointerId)) {
      this.active.set(pointerId, clientPoint(at));
    }
  }

  /** Forgets a pointer that has gone up, or that was taken away. */
  remove(pointerId: number): void {
    this.active.delete(pointerId);
  }

  /** Remembers what a pointer went down on, and where. */
  pressOn(subject: T, at: ClientPoint): void {
    this.press = { subject, at: clientPoint(at) };
  }

  get isPressing(): boolean {
    return this.press !== null;
  }

  /**
   * Whether the press has wandered further than a click may. A gesture that
   * has become a drag stays one, even if the pointer comes back to where it
   * started.
   */
  hasWandered(to: ClientPoint): boolean {
    return !!this.press && !isWithinClickTolerance(this.press.at, to);
  }

  /** Forgets the press without reporting it: the gesture was something else. */
  dropPress(): void {
    this.press = null;
  }

  /**
   * Reports what the pointer went down on and forgets it. Nothing when no
   * press is being watched.
   */
  takePress(): { subject: T; at: ClientPoint } | null {
    const press = this.press;
    this.press = null;
    return press;
  }

  /** Runs `onLongPress` once a pointer has rested long enough on one spot. */
  startLongPress(onLongPress: () => void): void {
    // a second finger must not orphan the timer of the first
    this.cancelLongPress();
    this.longPressTimer = setTimeout(onLongPress, LONG_PRESS_MS);
  }

  /** A moving or ending pointer is a drag or a tap, not a long press. */
  cancelLongPress(): void {
    if (this.longPressTimer !== null) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }
}
