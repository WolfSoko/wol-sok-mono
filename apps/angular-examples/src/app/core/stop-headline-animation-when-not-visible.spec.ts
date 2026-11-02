import { TestBed } from '@angular/core/testing';
import { HeadlineAnimationService } from '@wolsok/headline-animation';
import { stopHeadlineAnimationWhenNotVisible } from './stop-headline-animation-when-not-visible';

describe('stopHeadlineAnimationWhenNotVisible', () => {
  const observe = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    observe.mockClear();
    window.IntersectionObserver = jest.fn(() => ({
      observe,
      disconnect: jest.fn(),
      unobserve: jest.fn(),
      takeRecords: jest.fn(),
      root: null,
      rootMargin: '',
      thresholds: [],
    })) as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    jest.useRealTimers();
    document.getElementById('main-toolbar')?.remove();
  });

  it('waits for the toolbar without requestIdleCallback (Safari)', () => {
    expect('requestIdleCallback' in window).toBe(false);
    const service = {
      startAnimation: jest.fn(),
      stopAnimation: jest.fn(),
    } as unknown as HeadlineAnimationService;

    TestBed.runInInjectionContext(() =>
      stopHeadlineAnimationWhenNotVisible(service)
    );
    const toolbar = document.createElement('div');
    toolbar.id = 'main-toolbar';
    document.body.append(toolbar);
    jest.runOnlyPendingTimers();

    expect(observe).toHaveBeenCalledWith(toolbar);
  });
});
