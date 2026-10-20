import { inject, Injectable, Injector } from '@angular/core';
import {
  Analytics,
  setAnalyticsCollectionEnabled,
  setConsent,
} from '@angular/fire/analytics';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  ConsentBannerComponent,
  ConsentBannerData,
} from './consent-banner.component';
import { ConsentChoice, ConsentPrompt } from './consent';

const STORAGE_KEY = 'rap-analytics-consent';

/**
 * Google Consent Mode for Firebase Analytics, in its basic form: gtag.js loads
 * only once the visitor has granted analytics storage. Ad storage, ad user data
 * and ad personalization stay denied; RollaPolla shows no ads.
 */
@Injectable()
export class AnalyticsConsent implements ConsentPrompt {
  private readonly injector = inject(Injector);
  private readonly snackBar = inject(MatSnackBar);
  private choice = loadChoice();
  private analytics?: Analytics;

  /** Applies the choice made on an earlier visit, or asks for one. */
  public restore(): void {
    if (this.choice === null) {
      this.ask();
    } else {
      this.apply(this.choice);
    }
  }

  public ask(): void {
    this.snackBar.openFromComponent<ConsentBannerComponent, ConsentBannerData>(
      ConsentBannerComponent,
      { data: { decide: (choice) => this.decide(choice) } }
    );
  }

  public decide(choice: ConsentChoice): void {
    this.choice = choice;
    saveChoice(choice);
    this.apply(choice);
  }

  private apply(choice: ConsentChoice): void {
    if (this.analytics) {
      setConsent({ analytics_storage: choice });
      setAnalyticsCollectionEnabled(this.analytics, choice === 'granted');
      if (choice === 'denied') {
        deleteAnalyticsCookies();
      }
    } else if (choice === 'granted') {
      // set before the instance exists, the SDK sends it as the consent default
      // ahead of its first hit; an update sent now would overtake that default
      setConsent({
        analytics_storage: 'granted',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      });
      // AngularFire creates the instance, and loads gtag.js, on first injection
      this.analytics = this.injector.get(Analytics);
    }
  }
}

/**
 * Removes the client ids gtag.js stored (`_ga`, `_ga_<container>`). They sit on
 * the widest domain the browser allowed, so try every parent of the host.
 */
function deleteAnalyticsCookies(): void {
  const names = document.cookie
    .split(';')
    .map((cookie) => cookie.split('=')[0].trim())
    .filter((name) => name === '_ga' || name.startsWith('_ga_'));
  const labels = location.hostname.split('.');
  const domains = labels.map((_, i) => `; domain=${labels.slice(i).join('.')}`);
  for (const name of names) {
    for (const domain of ['', ...domains]) {
      document.cookie = `${name}=; max-age=0; path=/${domain}`;
    }
  }
}

function loadChoice(): ConsentChoice | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'granted' || stored === 'denied' ? stored : null;
  } catch {
    return null;
  }
}

function saveChoice(choice: ConsentChoice): void {
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // storage unavailable (private mode, quota): asked again on the next visit
  }
}
