import type { Mock } from 'vitest';
import { Injector, PendingTasks } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { pendingUntilFirstValue } from './pending-until-first-value';

describe('pendingUntilFirstValue', () => {
  let removeTask: Mock<() => void>;
  let injector: Injector;

  beforeEach(() => {
    vi.useFakeTimers();
    removeTask = vi.fn<() => void>();
    vi.spyOn(TestBed.inject(PendingTasks), 'add').mockReturnValue(removeTask);
    injector = TestBed.inject(Injector);
  });

  afterEach(() => vi.useRealTimers());

  it('stops waiting at the first value', () => {
    const source = new Subject<string>();
    const values: string[] = [];
    source
      .pipe(pendingUntilFirstValue(injector, 1500))
      .subscribe((value) => values.push(value));
    expect(removeTask).not.toHaveBeenCalled();

    source.next('poll');

    expect(removeTask).toHaveBeenCalled();
    expect(values).toEqual(['poll']);
  });

  it('stops waiting after the timeout but still passes later values', () => {
    const source = new Subject<string>();
    const values: string[] = [];
    source
      .pipe(pendingUntilFirstValue(injector, 1500))
      .subscribe((value) => values.push(value));

    vi.advanceTimersByTime(1499);
    expect(removeTask).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(removeTask).toHaveBeenCalled();

    source.next('late poll');
    expect(values).toEqual(['late poll']);
  });

  it('stops waiting when unsubscribed', () => {
    const subscription = new Subject<string>()
      .pipe(pendingUntilFirstValue(injector, 1500))
      .subscribe();

    subscription.unsubscribe();

    expect(removeTask).toHaveBeenCalled();
  });
});
