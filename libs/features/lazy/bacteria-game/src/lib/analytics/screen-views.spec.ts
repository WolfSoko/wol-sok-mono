import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  provideRecordingAnalytics,
  RecordingAnalytics,
} from '@wolsok/shared-analytics/testing';
import { trackScreenViews } from './screen-views';

describe('trackScreenViews', () => {
  it('counts each screen shown, and nothing while there is none', () => {
    const analytics = new RecordingAnalytics();
    TestBed.configureTestingModule({
      providers: [provideRecordingAnalytics(analytics)],
    });
    const screen = signal<string | null>('menu');
    TestBed.runInInjectionContext(() => trackScreenViews(screen));

    TestBed.tick();
    screen.set('settings');
    TestBed.tick();
    screen.set(null);
    TestBed.tick();
    screen.set('match');
    TestBed.tick();

    expect(analytics.screens).toEqual(['menu', 'settings', 'match']);
  });
});
