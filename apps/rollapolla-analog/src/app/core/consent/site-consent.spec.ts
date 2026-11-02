import { TestBed } from '@angular/core/testing';
import { ConsentPrompt, StoredConsent } from '@wolsok/shared-analytics';
import { AD_CONSENT } from './ad-consent';
import { SiteConsent } from './site-consent';

describe('SiteConsent', () => {
  beforeEach(() => localStorage.clear());

  function create(withAds = true) {
    const statistics = new StoredConsent('test-stats', () => undefined);
    const ads = new StoredConsent('test-ads', () => undefined);
    TestBed.configureTestingModule({
      providers: [
        { provide: ConsentPrompt, useValue: statistics },
        ...(withAds ? [{ provide: AD_CONSENT, useValue: ads }] : []),
      ],
    });
    return { site: TestBed.inject(SiteConsent), statistics, ads };
  }

  it('offers only the purposes that run here', () => {
    expect(create(false).site.purposes).toEqual(['statistics']);
    TestBed.resetTestingModule();
    expect(create().site.purposes).toEqual(['statistics', 'ads']);
  });

  it('asks while any purpose is due', () => {
    const { site, ads } = create();
    expect(site.asking()).toBe(false);

    ads.ask();

    expect(site.asking()).toBe(true);
  });

  it('tells and takes each choice', () => {
    const { site, statistics, ads } = create();

    site.decide({ statistics: true, ads: false });

    expect(statistics.choice()).toBe('granted');
    expect(ads.choice()).toBe('denied');
    expect(site.granted()).toEqual({ statistics: true, ads: false });
  });

  it('is not there where nothing asks for consent', () => {
    expect(TestBed.inject(SiteConsent).available).toBe(false);
  });
});
