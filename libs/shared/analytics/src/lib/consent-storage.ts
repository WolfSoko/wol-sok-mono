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

/**
 * Removes the client ids gtag.js stored (`_ga`, `_ga_<container>`). They sit on
 * the widest domain the browser allowed, so try every parent of the host.
 */
export function deleteAnalyticsCookies(): void {
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
