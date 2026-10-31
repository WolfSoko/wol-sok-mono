import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  ConsentChoice,
  ConsentPrompt,
  StoredConsent,
} from '@wolsok/shared-analytics';
import { AD_CONSENT } from './ad-consent';
import { ConsentBannerComponent } from './consent-banner.component';

describe('ConsentBannerComponent', () => {
  let statistics: StoredConsent;
  let ads: StoredConsent;
  let applied: { statistics: ConsentChoice[]; ads: ConsentChoice[] };
  let fixture: ComponentFixture<ConsentBannerComponent>;

  beforeEach(() => {
    localStorage.clear();
    applied = { statistics: [], ads: [] };
    statistics = new StoredConsent('test-stats', (choice) =>
      applied.statistics.push(choice)
    );
    ads = new StoredConsent('test-ads', (choice) => applied.ads.push(choice));
  });

  async function render(withPurposes = true): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        ...(withPurposes
          ? [
              { provide: ConsentPrompt, useValue: statistics },
              { provide: AD_CONSENT, useValue: ads },
            ]
          : []),
      ],
    });
    fixture = TestBed.createComponent(ConsentBannerComponent);
    await fixture.whenStable();
  }

  function byTestId(testId: string): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector(
      `[data-testid="${testId}"]`
    );
  }

  async function click(testId: string, selector?: string): Promise<void> {
    const target = byTestId(testId);
    (selector ? target?.querySelector<HTMLElement>(selector) : target)?.click();
    await fixture.whenStable();
  }

  it('stays empty where nothing asks for consent', async () => {
    await render(false);

    expect(byTestId('consent-banner')).toBeNull();
  });

  it('stays hidden while no choice is due', async () => {
    await render();

    expect(byTestId('consent-banner')).toBeNull();
  });

  it('names both purposes and links the privacy policy', async () => {
    statistics.ask();
    await render();

    expect(byTestId('consent-banner')?.textContent).toContain(
      'with Google Analytics and show ads from Google AdSense'
    );
    expect(byTestId('consent-privacy-link')?.getAttribute('href')).toBe(
      '/privacy'
    );
  });

  it.each([
    ['consent-accept', 'granted'],
    ['consent-decline', 'denied'],
  ] as const)('decides both purposes with %s', async (testId, choice) => {
    statistics.ask();
    ads.ask();
    await render();

    await click(testId);

    expect(applied).toEqual({ statistics: [choice], ads: [choice] });
    expect(byTestId('consent-banner')).toBeNull();
  });

  it('decides each purpose on its own after "Choose"', async () => {
    statistics.ask();
    ads.ask();
    await render();

    await click('consent-choose');
    await click('consent-statistics', 'button');
    await click('consent-save');

    expect(applied).toEqual({ statistics: ['granted'], ads: ['denied'] });
    expect(byTestId('consent-banner')).toBeNull();
  });

  it('starts "Choose" from the choices in force', async () => {
    statistics.decide('denied');
    ads.decide('granted');
    statistics.ask();
    ads.ask();
    await render();

    await click('consent-choose');
    await click('consent-save');

    expect(applied).toEqual({
      statistics: ['denied', 'denied'],
      ads: ['granted', 'granted'],
    });
  });
});
