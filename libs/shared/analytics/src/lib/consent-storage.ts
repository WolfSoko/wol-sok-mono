import { ConsentChoice } from './consent';

export function loadChoice(storageKey: string): ConsentChoice | null {
  try {
    const stored = localStorage.getItem(storageKey);
    return stored === 'granted' || stored === 'denied' ? stored : null;
  } catch {
    return null;
  }
}

export function saveChoice(storageKey: string, choice: ConsentChoice): void {
  try {
    localStorage.setItem(storageKey, choice);
  } catch {
    // storage unavailable (private mode, quota): asked again on the next visit
  }
}

/** The client ids gtag.js stores: `_ga`, `_ga_<container>`. */
export function isAnalyticsCookie(name: string): boolean {
  return name === '_ga' || name.startsWith('_ga_');
}

/**
 * Removes the cookies `matches` names, from this site's own domain: a
 * third party's cookies on its domains are out of reach. They sit on the
 * widest domain the browser allowed, so try every parent of the host.
 */
export function deleteCookies(matches: (name: string) => boolean): void {
  const names = document.cookie
    .split(';')
    .map((cookie) => cookie.split('=')[0].trim())
    .filter(matches);
  const labels = location.hostname.split('.');
  const domains = labels.map((_, i) => `; domain=${labels.slice(i).join('.')}`);
  for (const name of names) {
    for (const domain of ['', ...domains]) {
      document.cookie = `${name}=; max-age=0; path=/${domain}`;
    }
  }
}
