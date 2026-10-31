import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  AD_CONSENT,
  ADS_CONSENT_KEY,
  ADSENSE_CLIENT,
  ADSENSE_SCRIPT_ID,
  provideAdSense,
} from './ad-consent';

type AdsWindow = Window & {
  adsbygoogle?: unknown[] & { pauseAdRequests?: 0 | 1 };
};

describe('provideAdSense', () => {
  const adsWindow = window as AdsWindow;

  beforeEach(() => {
    localStorage.clear();
    document.getElementById(ADSENSE_SCRIPT_ID)?.remove();
    delete adsWindow.adsbygoogle;
  });

  afterEach(() => {
    document.cookie = 'kept=; max-age=0; path=/';
  });

  function render(stored?: 'granted' | 'denied') {
    if (stored) localStorage.setItem(ADS_CONSENT_KEY, stored);
    TestBed.configureTestingModule({ providers: [provideAdSense()] });
    TestBed.inject(ApplicationRef).tick();
    return TestBed.inject(AD_CONSENT);
  }

  function script(): HTMLScriptElement | null {
    return document.getElementById(ADSENSE_SCRIPT_ID) as HTMLScriptElement;
  }

  it('asks first and loads no ad script before the visitor agrees', () => {
    const consent = render();

    expect(consent.asking()).toBe(true);
    expect(script()).toBeNull();
  });

  it('loads the ad script once the visitor agrees', () => {
    const consent = render();

    consent.decide('granted');
    consent.decide('granted');

    expect(document.querySelectorAll(`#${ADSENSE_SCRIPT_ID}`)).toHaveLength(1);
    expect(script()?.src).toContain(`client=${ADSENSE_CLIENT}`);
    expect(adsWindow.adsbygoogle?.pauseAdRequests).toBe(0);
    expect(localStorage.getItem(ADS_CONSENT_KEY)).toBe('granted');
  });

  it('loads it right away when agreed on an earlier visit', () => {
    const consent = render('granted');

    expect(consent.asking()).toBe(false);
    expect(script()).not.toBeNull();
  });

  it('loads nothing when declined on an earlier visit', () => {
    const consent = render('denied');

    expect(consent.asking()).toBe(false);
    expect(script()).toBeNull();
  });

  it("pauses the ads and deletes Google's ad cookies when withdrawn", () => {
    const consent = render('granted');
    document.cookie = '__gads=ID; path=/';
    document.cookie = 'kept=yes; path=/';

    consent.decide('denied');

    expect(adsWindow.adsbygoogle?.pauseAdRequests).toBe(1);
    expect(document.cookie).toBe('kept=yes');
  });
});
