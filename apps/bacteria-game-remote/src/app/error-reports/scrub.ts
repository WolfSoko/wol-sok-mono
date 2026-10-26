import type { Breadcrumb, ErrorEvent } from '@sentry/angular';

/**
 * What an error report may carry (the owner's decision of 2026-10-26):
 * errors only and no personal data. Kept apart from the SDK, so the specs
 * run without it and the game's first load does not wait for it.
 */

/**
 * The address without its query and hash: the hash holds invitation codes
 * (`#friend=…`) and shared runs, the query whatever a link brought along.
 */
export function stripUrl(url: string): string {
  const end = url.search(/[?#]/);
  return end === -1 ? url : url.slice(0, end);
}

/**
 * Account and document ids, as Firebase errors name them in a path
 * (`players/<uid>/…`): 20 or more letters and digits, with at least one of
 * each, so ordinary words and numbers stay.
 */
const ID = /\b(?=[A-Za-z0-9]*\d)(?=[A-Za-z0-9]*[A-Za-z])[A-Za-z0-9]{20,}\b/g;

/** The text with every id-like token replaced by `<id>`. */
export function scrubIds(text: string): string {
  return text.replace(ID, '<id>');
}

/** Drops the user and cookies and strips URLs and ids from the event. */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  delete event.user;
  if (event.request) {
    delete event.request.cookies;
    delete event.request.query_string;
    if (event.request.url) {
      event.request.url = stripUrl(event.request.url);
    }
    if (event.request.headers) {
      // The page that linked here, query and all.
      delete event.request.headers['Referer'];
      delete event.request.headers['referer'];
    }
  }
  if (event.message) {
    event.message = scrubIds(event.message);
  }
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) {
      exception.value = scrubIds(exception.value);
    }
  }
  return event;
}

/** The URL fields the browser SDK's breadcrumbs carry. */
const URL_FIELDS = ['url', 'from', 'to'] as const;

/**
 * No console breadcrumbs (the game logs ids there), and the URLs of
 * navigations and requests without query and hash.
 */
export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (breadcrumb.category === 'console') {
    return null;
  }
  const data = breadcrumb.data;
  if (data) {
    for (const field of URL_FIELDS) {
      const value: unknown = data[field];
      if (typeof value === 'string') {
        data[field] = scrubIds(stripUrl(value));
      }
    }
  }
  if (breadcrumb.message) {
    breadcrumb.message = scrubIds(breadcrumb.message);
  }
  return breadcrumb;
}
