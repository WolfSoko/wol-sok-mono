import { TestBed } from '@angular/core/testing';
import { NOW } from './now';

const START = new Date('2026-11-08T09:00:00Z');

describe('NOW', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(START);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is the time at start', () => {
    expect(TestBed.inject(NOW)()).toBe(START.getTime());
  });

  it('moves on every minute', () => {
    const now = TestBed.inject(NOW);

    vi.advanceTimersByTime(60_000);

    expect(now()).toBe(START.getTime() + 60_000);
  });

  it('reads the time again when the page comes back into view', () => {
    const now = TestBed.inject(NOW);
    vi.setSystemTime(new Date('2026-11-08T11:00:00Z'));

    document.dispatchEvent(new Event('visibilitychange'));

    expect(now()).toBe(Date.parse('2026-11-08T11:00:00Z'));
  });

  it('stops with the app', () => {
    const now = TestBed.inject(NOW);
    TestBed.resetTestingModule();

    vi.advanceTimersByTime(60_000);
    document.dispatchEvent(new Event('visibilitychange'));

    expect(now()).toBe(START.getTime());
  });
});
