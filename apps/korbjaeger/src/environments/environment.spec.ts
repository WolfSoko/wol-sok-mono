// @vitest-environment node
import { readFileSync } from 'node:fs';
import { environment } from './environment';

/** The Firebase project the deploy goes to: `.firebaserc`'s alias. */
function deployedProjectId(): string {
  const firebaserc = JSON.parse(
    readFileSync(new URL('../../../../.firebaserc', import.meta.url), 'utf8')
  ) as { projects: Record<string, string> };
  return firebaserc.projects['korbjaeger'];
}

describe('the environment', () => {
  it('names the Firebase project the app is deployed to', () => {
    const projectId = deployedProjectId();
    const { firebase } = environment;

    expect(firebase.projectId).toBe(projectId);
    expect(firebase.authDomain).toBe(`${projectId}.firebaseapp.com`);
    expect(firebase.storageBucket).toBe(`${projectId}.firebasestorage.app`);
  });
});
