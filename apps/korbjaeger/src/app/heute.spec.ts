import { TestBed } from '@angular/core/testing';
import { HEUTE } from './heute';

/** The page coming back into view, as a woken tablet's does. */
function sichtbarWerden(): void {
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('HEUTE', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // 23:30 in Germany
    vi.setSystemTime(new Date('2026-11-08T22:30:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is today's German date", () => {
    expect(TestBed.inject(HEUTE)()).toBe('2026-11-08');
  });

  it('reads the day again when the page comes back into view', () => {
    const heute = TestBed.inject(HEUTE);
    vi.setSystemTime(new Date('2026-11-09T06:00:00Z'));

    sichtbarWerden();

    expect(heute()).toBe('2026-11-09');
  });

  it('stops listening with the app', () => {
    const heute = TestBed.inject(HEUTE);
    TestBed.resetTestingModule();
    vi.setSystemTime(new Date('2026-11-09T06:00:00Z'));

    sichtbarWerden();

    expect(heute()).toBe('2026-11-08');
  });
});
