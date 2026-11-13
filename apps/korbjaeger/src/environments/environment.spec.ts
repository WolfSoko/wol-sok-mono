// @vitest-environment node
import { readFileSync } from 'node:fs';
import { environment, environmentFor } from './environment';

/** A file of the workspace, as JSON. */
function workspaceJson<T>(path: string): T {
  return JSON.parse(
    readFileSync(new URL(`../../../../${path}`, import.meta.url), 'utf8')
  ) as T;
}

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

  it('signs in against the emulators `korbjaeger:emulatoren` runs, on a demo project', () => {
    const { emulators } = workspaceJson<{
      emulators: Record<string, { host: string; port: number }>;
    }>('apps/korbjaeger/firebase.emulatoren.json');
    const configured = environment.emulators;

    expect(environment.signIn).toBe(true);
    expect(configured?.projectId).toMatch(/^demo-/);
    expect(configured?.authUrl).toBe(
      `http://${emulators['auth'].host}:${emulators['auth'].port}`
    );
    expect(configured?.firestore).toEqual({
      host: emulators['firestore'].host,
      port: emulators['firestore'].port,
    });
  });

  it('offers the sign-in in production, on the real project, no emulator near it', () => {
    const production = environmentFor('production');

    expect(production.signIn).toBe(true);
    expect(production.emulators).toBeUndefined();
    expect(production.firebase).toEqual(environment.firebase);
  });

  it.each(['development', 'e2e'])(
    'signs in against the emulators in %s',
    (mode) => {
      expect(environmentFor(mode)).toEqual(environment);
    }
  );
});
