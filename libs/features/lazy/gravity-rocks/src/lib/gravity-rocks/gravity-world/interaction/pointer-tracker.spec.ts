import {
  CLICK_TOLERANCE_PX,
  isWithinClickTolerance,
  LONG_PRESS_MS,
  PointerTracker,
} from './pointer-tracker';

describe('isWithinClickTolerance', () => {
  const origin = { clientX: 100, clientY: 100 };

  it('should call the spot it started on the same spot', () => {
    expect(isWithinClickTolerance(origin, origin)).toBe(true);
  });

  it('should allow the shake of a hand on the mouse', () => {
    const shaken = {
      clientX: 100 + CLICK_TOLERANCE_PX,
      clientY: 100 - CLICK_TOLERANCE_PX,
    };
    expect(isWithinClickTolerance(origin, shaken)).toBe(true);
  });

  it('should call anything further a drag', () => {
    const dragged = { clientX: 100 + CLICK_TOLERANCE_PX + 1, clientY: 100 };
    expect(isWithinClickTolerance(origin, dragged)).toBe(false);
  });
});

describe('PointerTracker', () => {
  let tracker: PointerTracker<string>;

  beforeEach(() => {
    jest.useFakeTimers();
    tracker = new PointerTracker<string>();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should count the pointers that are down', () => {
    expect(tracker.count).toBe(0);

    tracker.add(1, { clientX: 0, clientY: 0 });
    tracker.add(2, { clientX: 10, clientY: 0 });
    expect(tracker.count).toBe(2);

    tracker.remove(1);
    expect(tracker.count).toBe(1);
  });

  it('should offer a pair only while two pointers are down', () => {
    tracker.add(1, { clientX: 0, clientY: 0 });
    expect(tracker.pair).toBeNull();

    tracker.add(2, { clientX: 10, clientY: 0 });
    expect(tracker.pair).toEqual([
      { clientX: 0, clientY: 0 },
      { clientX: 10, clientY: 0 },
    ]);

    tracker.remove(2);
    expect(tracker.pair).toBeNull();
  });

  it('should offer no pair for three fingers, which are not a pinch', () => {
    tracker.add(1, { clientX: 0, clientY: 0 });
    tracker.add(2, { clientX: 10, clientY: 0 });
    tracker.add(3, { clientX: 20, clientY: 0 });

    expect(tracker.pair).toBeNull();

    // and it is a pinch again once the third finger is lifted
    tracker.remove(3);
    expect(tracker.pair).not.toBeNull();
  });

  it('should keep a copy, so a moving pointer does not rewrite the past', () => {
    const live = { clientX: 0, clientY: 0 };
    tracker.add(1, live);
    live.clientX = 500;

    expect(tracker.pair).toBeNull();
    tracker.add(2, { clientX: 10, clientY: 0 });
    expect(tracker.pair?.[0]).toEqual({ clientX: 0, clientY: 0 });
  });

  it('should follow a pointer that is down, and ignore one that is not', () => {
    tracker.add(1, { clientX: 0, clientY: 0 });
    tracker.add(2, { clientX: 10, clientY: 0 });

    tracker.moveTo(1, { clientX: 5, clientY: 5 });
    tracker.moveTo(9, { clientX: 999, clientY: 999 });

    expect(tracker.count).toBe(2);
    expect(tracker.pair?.[0]).toEqual({ clientX: 5, clientY: 5 });
  });

  it('should report what a tap went down on, once', () => {
    tracker.pressOn('mercury', { clientX: 100, clientY: 100 });
    expect(tracker.isPressing).toBe(true);

    expect(tracker.takePress()?.subject).toBe('mercury');
    expect(tracker.takePress()).toBeNull();
    expect(tracker.isPressing).toBe(false);
  });

  it('should notice a press that has wandered off into a drag', () => {
    tracker.pressOn('mercury', { clientX: 100, clientY: 100 });

    expect(tracker.hasWandered({ clientX: 102, clientY: 100 })).toBe(false);
    expect(tracker.hasWandered({ clientX: 140, clientY: 100 })).toBe(true);
  });

  it('should say nothing has wandered when nothing is pressed', () => {
    expect(tracker.hasWandered({ clientX: 999, clientY: 999 })).toBe(false);
  });

  it('should forget a press that was dropped', () => {
    tracker.pressOn('mercury', { clientX: 100, clientY: 100 });
    tracker.dropPress();

    expect(tracker.isPressing).toBe(false);
    expect(tracker.takePress()).toBeNull();
  });

  it('should report a long press once the finger has rested', () => {
    const rested = jest.fn();
    tracker.startLongPress(rested);

    jest.advanceTimersByTime(LONG_PRESS_MS - 1);
    expect(rested).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(rested).toHaveBeenCalledTimes(1);
  });

  it('should not report a long press that was cancelled', () => {
    const rested = jest.fn();
    tracker.startLongPress(rested);
    tracker.cancelLongPress();

    jest.advanceTimersByTime(LONG_PRESS_MS * 2);

    expect(rested).not.toHaveBeenCalled();
  });

  it('should let a second finger take over the long press of the first', () => {
    const first = jest.fn();
    const second = jest.fn();
    tracker.startLongPress(first);
    jest.advanceTimersByTime(LONG_PRESS_MS - 10);
    tracker.startLongPress(second);

    jest.advanceTimersByTime(LONG_PRESS_MS);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
