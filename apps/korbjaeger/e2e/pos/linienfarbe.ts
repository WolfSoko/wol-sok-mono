import type { Locator } from '@playwright/test';

/** The colour of a heading's court line (`h1`), as the browser computes it. */
export function linienfarbe(heading: Locator): Promise<string> {
  return heading.evaluate((h1) => getComputedStyle(h1).borderBlockEndColor);
}
