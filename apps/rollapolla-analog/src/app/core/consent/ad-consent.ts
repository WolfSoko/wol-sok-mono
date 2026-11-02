import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  EnvironmentProviders,
  inject,
  Injectable,
  InjectionToken,
  makeEnvironmentProviders,
  provideEnvironmentInitializer,
} from '@angular/core';
import {
  ConsentChoice,
  ConsentPrompt,
  deleteCookies,
  StoredConsent,
} from '@wolsok/shared-analytics';

export const ADS_CONSENT_KEY = 'rap-ads-consent';
export const ADSENSE_CLIENT = 'ca-pub-6346271540341424';
export const ADSENSE_SCRIPT_ID = 'rap-adsense';
const ADSENSE_SRC = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;

/** The cookies Google's ads set on RollaPolla's own domain. */
const AD_COOKIES = new Set(['__gads', '__gpi', '__eoi', 'FCNEC', 'FCCDCF']);

/** The visitor's say over the ads, beside `ConsentPrompt` for analytics. */
export const AD_CONSENT = new InjectionToken<ConsentPrompt>('AD_CONSENT');

/** AdSense's queue: `pauseAdRequests` holds back or lets through ad requests. */
type AdsQueue = unknown[] & { pauseAdRequests?: 0 | 1 };
type AdsWindow = Window & { adsbygoogle?: AdsQueue };

/**
 * Google AdSense, only with the visitor's consent: the ad script loads
 * once they agree, and not before - Google gets nothing from a visitor who
 * did not. Withdrawn, ad requests pause at once and Google's cookies on
 * RollaPolla's domain go; the script itself stays until the page reloads.
 */
@Injectable()
export class AdSenseConsent {
  private readonly document = inject(DOCUMENT);
  public readonly consent = new StoredConsent(ADS_CONSENT_KEY, (choice) =>
    this.apply(choice)
  );

  private apply(choice: ConsentChoice): void {
    const window = this.document.defaultView as AdsWindow | null;
    if (!window) return;
    const ads = (window.adsbygoogle ??= []);
    if (choice === 'granted') {
      ads.pauseAdRequests = 0;
      this.loadScript();
    } else {
      ads.pauseAdRequests = 1;
      deleteCookies((name) => AD_COOKIES.has(name));
    }
  }

  private loadScript(): void {
    if (this.document.getElementById(ADSENSE_SCRIPT_ID)) return;
    const script = this.document.createElement('script');
    script.id = ADSENSE_SCRIPT_ID;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = ADSENSE_SRC;
    this.document.head.appendChild(script);
  }
}

/**
 * AdSense behind its consent. Browser only, like the analytics: `main.ts`
 * adds it in production.
 */
export function provideAdSense(): EnvironmentProviders {
  return makeEnvironmentProviders([
    AdSenseConsent,
    { provide: AD_CONSENT, useFactory: () => inject(AdSenseConsent).consent },
    provideEnvironmentInitializer(() => {
      const ads = inject(AdSenseConsent);
      // after the first render, so neither the banner nor the ad script
      // competes with hydration
      afterNextRender(() => ads.consent.restore());
    }),
  ]);
}
