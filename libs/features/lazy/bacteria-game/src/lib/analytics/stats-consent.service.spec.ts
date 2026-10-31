import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ConsentChoice, ConsentPrompt } from '@wolsok/shared-analytics';
import { GameAds } from '../support/ads/game-ads.service';
import { StatsConsent } from './stats-consent.service';

describe('StatsConsent', () => {
  const asking = signal(false);
  const choice = signal<ConsentChoice | null>(null);
  const settled = signal(false);
  const decide = jest.fn();

  beforeEach(() => {
    asking.set(true);
    choice.set(null);
    settled.set(false);
    decide.mockClear();
  });

  function create(prompt = true): StatsConsent {
    TestBed.configureTestingModule({
      providers: [
        { provide: GameAds, useValue: { consentSettled: settled } },
        prompt
          ? { provide: ConsentPrompt, useValue: { asking, choice, decide } }
          : [],
      ],
    });
    return TestBed.inject(StatsConsent);
  }

  it('asks only once the ads consent banner is done with', () => {
    const consent = create();
    expect(consent.asking()).toBe(false);

    settled.set(true);

    expect(consent.asking()).toBe(true);
  });

  it('asks nothing once the player answered', () => {
    const consent = create();
    settled.set(true);

    asking.set(false);

    expect(consent.asking()).toBe(false);
  });

  it("passes the player's answer on, and tells it", () => {
    const consent = create();

    consent.decide(true);
    consent.decide(false);
    choice.set('granted');

    expect(decide.mock.calls).toEqual([['granted'], ['denied']]);
    expect(consent.granted()).toBe(true);
  });

  it('asks nothing where the game does not measure, as inside the shell', () => {
    const consent = create(false);
    settled.set(true);

    expect(consent.available).toBe(false);
    expect(consent.asking()).toBe(false);
    expect(consent.granted()).toBe(false);
  });
});
