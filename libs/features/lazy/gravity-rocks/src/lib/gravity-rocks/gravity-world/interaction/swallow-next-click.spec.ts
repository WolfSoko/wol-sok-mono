import { SYNTHETIC_CLICK_MS, swallowNextClick } from './swallow-next-click';

describe('swallowNextClick', () => {
  let landed: number;
  let listener: () => void;

  beforeEach(() => {
    jest.useFakeTimers();
    landed = 0;
    listener = () => landed++;
    document.addEventListener('click', listener);
  });

  afterEach(() => {
    document.removeEventListener('click', listener);
    jest.useRealTimers();
  });

  /** A click the way a lifted finger produces one. */
  function click(): void {
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }

  it('should eat the one click a lifted finger turns into', () => {
    swallowNextClick();

    click();

    expect(landed).toBe(0);
  });

  it('should let every click after that one through', () => {
    swallowNextClick();
    click();

    click();
    click();

    expect(landed).toBe(2);
  });

  it('should stop waiting once the browser can no longer send that click', () => {
    swallowNextClick();

    jest.advanceTimersByTime(SYNTHETIC_CLICK_MS);
    click();

    expect(landed).toBe(1);
  });
});
