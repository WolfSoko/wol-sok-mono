import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { KORBJAEGER_DOMAIN, KORBJAEGER_HOSTING_SITE } from './korbjaeger-site';

/** A file of the workspace, read as the deploy reads it. */
function workspaceFile(path: string): string {
  return readFileSync(join(__dirname, '../../..', path), 'utf8');
}

describe('the site of Korbjäger', () => {
  it('is the domain the app names as its SITE_URL', () => {
    // the stack cannot import it (see KORBJAEGER_DOMAIN)
    expect(workspaceFile('apps/korbjaeger/src/shared/site.ts')).toContain(
      `export const SITE_URL = 'https://${KORBJAEGER_DOMAIN}';`
    );
  });

  it('is the default site of the project the app deploys to', () => {
    const { projects } = JSON.parse(workspaceFile('.firebaserc')) as {
      projects: Record<string, string>;
    };

    expect(projects['korbjaeger']).toBe(KORBJAEGER_HOSTING_SITE);
  });
});
