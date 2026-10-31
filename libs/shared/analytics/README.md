# shared-analytics

Usage statistics with Firebase Analytics (GA4), only with the visitor's
consent (Google Consent Mode, basic: nothing loads before it).

- `provideFirebaseAnalytics({ storageKey, app })` in the browser's app config
  turns it on: page views from the router (the route's pattern, never the URL,
  query or hash) and the events the app tracks.
- `Analytics` (`track`, `screenView`, `setUserProperties`) is what the app
  calls; inject it optionally, so builds and hosts without analytics stay
  free of it.
- `ConsentPrompt` (`asking`, `choice`, `ask`, `decide`) is what the app's
  consent banner and settings use. `StoredConsent` is one consent kept in
  `localStorage` - the analytics' own, and any other purpose an app asks
  for (RollaPolla's ads); `deleteCookies` clears a purpose's cookies. Events from before the choice wait in
  memory and are sent only once the visitor consents.

What each app measures, and what to set up in GA4 for it, is in
[`docs/analytics.md`](../../../docs/analytics.md).

Run `nx test shared-analytics` for the unit tests.
