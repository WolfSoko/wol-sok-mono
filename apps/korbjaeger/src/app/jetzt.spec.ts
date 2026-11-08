import { TestBed } from '@angular/core/testing';
import { JETZT } from './jetzt';

const START = new Date('2026-11-08T09:00:00Z');

describe('JETZT', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(START);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is the time at start', () => {
    expect(TestBed.inject(JETZT)()).toBe(START.getTime());
  });

  it('moves on every minute', () => {
    const jetzt = TestBed.inject(JETZT);

    vi.advanceTimersByTime(60_000);

    expect(jetzt()).toBe(START.getTime() + 60_000);
  });

  it('reads the time again when the page comes back into view', () => {
    const jetzt = TestBed.inject(JETZT);
    vi.setSystemTime(new Date('2026-11-08T11:00:00Z'));

    document.dispatchEvent(new Event('visibilitychange'));

    expect(jetzt()).toBe(Date.parse('2026-11-08T11:00:00Z'));
  });

  it('stops with the app', () => {
    const jetzt = TestBed.inject(JETZT);
    TestBed.resetTestingModule();

    vi.advanceTimersByTime(60_000);
    document.dispatchEvent(new Event('visibilitychange'));

    expect(jetzt()).toBe(START.getTime());
  });
});
