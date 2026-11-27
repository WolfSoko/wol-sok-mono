import { TestBed } from '@angular/core/testing';
import {
  Event,
  NavigationCancel,
  NavigationCancellationCode,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
} from '@angular/router';
import { Subject } from 'rxjs';
import { navigationLoading, SLOW_NAVIGATION_MS } from './navigation-loading';

describe('navigationLoading', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  function setUp() {
    const events = new Subject<Event>();
    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: { events } }],
    });
    const loading = TestBed.runInInjectionContext(navigationLoading);
    return { events, loading };
  }

  const start = new NavigationStart(1, '/slow');

  it('is false for a navigation quicker than the threshold', () => {
    const { events, loading } = setUp();
    events.next(start);
    jest.advanceTimersByTime(SLOW_NAVIGATION_MS - 1);
    events.next(new NavigationEnd(1, '/slow', '/slow'));
    jest.advanceTimersByTime(SLOW_NAVIGATION_MS);
    expect(loading()).toBe(false);
  });

  it.each([
    ['ends', new NavigationEnd(1, '/slow', '/slow')],
    [
      'is cancelled',
      new NavigationCancel(
        1,
        '/slow',
        'guard',
        NavigationCancellationCode.GuardRejected
      ),
    ],
    ['fails', new NavigationError(1, '/slow', new Error('remote missing'))],
  ])('is true for a slow navigation until it %s', (_, end) => {
    const { events, loading } = setUp();
    events.next(start);
    jest.advanceTimersByTime(SLOW_NAVIGATION_MS);
    expect(loading()).toBe(true);
    events.next(end);
    expect(loading()).toBe(false);
  });
});
