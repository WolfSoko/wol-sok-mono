import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The app's domain, as its `SITE_URL` (`apps/korbjaeger/src/shared/site.ts`)
 * names it. The stack cannot import that constant: an app is no lib, and
 * infra may depend on `infra-shared` libs only. The spec keeps both equal.
 */
export const KORBJAEGER_DOMAIN = 'korb.wolsok.de';

/** The app's alias in `.firebaserc`, as its `firebase` target passes it. */
const FIREBASE_ALIAS = 'korbjaeger';

/**
 * The default Hosting site of the project `firebaserc` gives `alias`: a
 * project's default site carries the project's id. So the id lives in
 * `.firebaserc` alone, for the deploy and for the CNAME alike.
 */
export function defaultHostingSite(firebaserc: string, alias: string): string {
  const { projects } = JSON.parse(firebaserc) as {
    projects?: Record<string, string>;
  };
  const projectId = projects?.[alias];
  if (!projectId) {
    throw new Error(`No Firebase project for '${alias}' in .firebaserc`);
  }
  return projectId;
}

/** The Hosting site the app deploys to, read from the workspace's `.firebaserc`. */
export function korbjaegerHostingSite(): string {
  const firebaserc = readFileSync(
    join(__dirname, '../../../.firebaserc'),
    'utf8'
  );
  return defaultHostingSite(firebaserc, FIREBASE_ALIAS);
}
