import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  defaultHostingSite,
  KORBJAEGER_DOMAIN,
  korbjaegerHostingSite,
} from './korbjaeger-site';

describe('the site of Korbjäger', () => {
  it('is the domain the app names as its SITE_URL', () => {
    // the stack cannot import it (see KORBJAEGER_DOMAIN)
    const appSite = readFileSync(
      join(__dirname, '../../korbjaeger/src/shared/site.ts'),
      'utf8'
    );

    expect(appSite).toContain(
      `export const SITE_URL = 'https://${KORBJAEGER_DOMAIN}';`
    );
  });

  it("is hosted where the workspace's .firebaserc deploys it", () => {
    expect(korbjaegerHostingSite()).toMatch(/^[a-z0-9-]+$/);
  });

  describe('defaultHostingSite', () => {
    const firebaserc = JSON.stringify({
      projects: { korbjaeger: 'korbjaeger-1234', other: 'other-5678' },
    });

    it("is the project id .firebaserc gives the app's alias", () => {
      // a project's default Hosting site carries the project's id
      expect(defaultHostingSite(firebaserc, 'korbjaeger')).toBe(
        'korbjaeger-1234'
      );
    });

    it('fails on an alias .firebaserc does not know', () => {
      expect(() => defaultHostingSite(firebaserc, 'missing')).toThrow(
        "No Firebase project for 'missing' in .firebaserc"
      );
    });
  });
});
