import { TestBed } from '@angular/core/testing';
import { TODAY } from './today';

/** The page coming back into view, as a woken tablet's does. */
function becomeVisible(): void {
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('TODAY', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // 23:30 in Germany
    vi.setSystemTime(new Date('2026-11-08T22:30:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is today's German date", () => {
    expect(TestBed.inject(TODAY)()).toBe('2026-11-08');
  });

  it('reads the day again when the page comes back into view', () => {
    const today = TestBed.inject(TODAY);
    vi.setSystemTime(new Date('2026-11-09T06:00:00Z'));

    becomeVisible();

    expect(today()).toBe('2026-11-09');
  });

  it('stops listening with the app', () => {
    const today = TestBed.inject(TODAY);
    TestBed.resetTestingModule();
    vi.setSystemTime(new Date('2026-11-09T06:00:00Z'));

    becomeVisible();

    expect(today()).toBe('2026-11-08');
  });
});
