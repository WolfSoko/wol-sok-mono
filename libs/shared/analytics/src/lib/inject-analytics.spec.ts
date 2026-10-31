import { TestBed } from '@angular/core/testing';
import { Analytics } from './analytics';
import { injectAnalytics } from './inject-analytics';

type TestEvents = {
  poll_created: { options: number; listed: boolean };
  poll_deleted: Record<string, never>;
};

describe('injectAnalytics', () => {
  function create(analytics?: Analytics) {
    TestBed.configureTestingModule({
      providers: analytics ? [{ provide: Analytics, useValue: analytics }] : [],
    });
    return TestBed.runInInjectionContext(() => injectAnalytics<TestEvents>());
  }

  it('passes the events on to the analytics that runs', () => {
    const analytics = {
      track: vi.fn(),
      screenView: vi.fn(),
      setUserProperties: vi.fn(),
    };
    const tracker = create(analytics);

    tracker.track('poll_created', { options: 3, listed: true });
    tracker.track('poll_deleted');
    tracker.screenView('menu');
    tracker.setUserProperties({ account: 'guest' });

    expect(analytics.track.mock.calls).toEqual([
      ['poll_created', { options: 3, listed: true }],
      ['poll_deleted', undefined],
    ]);
    expect(analytics.screenView).toHaveBeenCalledExactlyOnceWith('menu');
    expect(analytics.setUserProperties).toHaveBeenCalledExactlyOnceWith({
      account: 'guest',
    });
  });

  it('does nothing where analytics does not run', () => {
    const tracker = create();

    expect(() => {
      tracker.track('poll_deleted');
      tracker.screenView('menu');
      tracker.setUserProperties({ account: 'guest' });
    }).not.toThrow();
  });
});
