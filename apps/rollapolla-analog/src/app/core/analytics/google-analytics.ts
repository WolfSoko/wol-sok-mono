import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  EnvironmentProviders,
  inject,
  PLATFORM_ID,
  provideEnvironmentInitializer,
} from '@angular/core';

type GtagWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
};

/**
 * Loads the Google tag (gtag.js) for a GA4 measurement id, in the browser
 * only. Without an id nothing is loaded, so `nx serve` and the e2e tests
 * (environment.develop) send no traffic. Page views on in-app navigation come
 * from GA4's enhanced measurement, which listens to the history API.
 */
export function provideGoogleAnalytics(
  measurementId: string | undefined
): EnvironmentProviders {
  return provideEnvironmentInitializer(() => {
    if (!measurementId || !isPlatformBrowser(inject(PLATFORM_ID))) {
      return;
    }
    installGoogleTag(inject(DOCUMENT), measurementId);
  });
}

/** The Google tag snippet, as `gtag.js` expects it. */
export function installGoogleTag(
  document: Document,
  measurementId: string
): void {
  const window = document.defaultView as GtagWindow | null;
  if (!window) {
    return;
  }
  const dataLayer = (window.dataLayer ??= []);
  // gtag.js only processes `arguments` objects on the data layer, not arrays
  window.gtag ??= function () {
    dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', measurementId);

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);
}
