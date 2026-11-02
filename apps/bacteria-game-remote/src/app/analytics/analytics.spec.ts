import { TestBed } from '@angular/core/testing';
import type { GameCloudOptions } from '@wolsok/feat-lazy-bac-game';
import { Analytics, ConsentPrompt } from '@wolsok/shared-analytics';
import { environment as e2e } from '../../environments/environment.e2e';
import { environment as prod } from '../../environments/environment.prod';
import { provideGameAnalytics } from './analytics';

describe('provideGameAnalytics', () => {
  function provided(cloud: GameCloudOptions | null) {
    TestBed.configureTestingModule({
      providers: [provideGameAnalytics(cloud)],
    });
    return {
      consent: TestBed.inject(ConsentPrompt, null),
      analytics: TestBed.inject(Analytics, null),
    };
  }

  it('measures the live site, asking the player first', () => {
    const { consent, analytics } = provided(prod.gameCloud);

    expect(prod.gameCloud?.firebase.measurementId).toBeTruthy();
    expect(consent).not.toBeNull();
    expect(analytics).not.toBeNull();
  });

  it.each([
    ['without the cloud', null],
    ['against the emulators (e2e)', e2e.gameCloud],
  ])('measures nothing %s', (_, cloud) => {
    expect(provided(cloud)).toEqual({ consent: null, analytics: null });
  });
});
