import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { debounced } from './debounced';

@Component({ template: '' })
class Host {
  public readonly source = signal('a');
  public readonly settled = debounced(this.source, 300);
}

describe('debounced', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function host(): Host {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('has the first value at once', () => {
    expect(host().settled()).toBe('a');
  });

  it('takes a new value only once it stayed for the time given', async () => {
    const { source, settled } = host();

    source.set('ab');
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(200);
    source.set('abc');
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(299);
    expect(settled()).toBe('a');

    await vi.advanceTimersByTimeAsync(1);
    expect(settled()).toBe('abc');
  });

  it('waits by the timer, not the clock', async () => {
    vi.setSystemTime(new Date('2026-11-08T12:00:00+01:00'));
    const { source, settled } = host();

    source.set('ab');
    TestBed.tick();
    // the clock stands still, as under a fixed time; only the timer runs
    vi.advanceTimersToNextTimer();

    expect(settled()).toBe('ab');
  });
});
