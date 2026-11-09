// @vitest-environment node
import { readFileSync } from 'node:fs';
import { environment, environmentFuer } from './environment';

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
    const emulatoren = environment.emulatoren;

    expect(environment.anmeldung).toBe(true);
    expect(emulatoren?.projektId).toMatch(/^demo-/);
    expect(emulatoren?.authUrl).toBe(
      `http://${emulators['auth'].host}:${emulators['auth'].port}`
    );
    expect(emulatoren?.firestore).toEqual({
      host: emulators['firestore'].host,
      port: emulators['firestore'].port,
    });
  });

  it('keeps the sign-in off and the emulators away in production', () => {
    const produktion = environmentFuer('production');

    expect(produktion.anmeldung).toBe(false);
    expect(produktion.emulatoren).toBeUndefined();
    expect(produktion.firebase).toEqual(environment.firebase);
  });

  it.each(['development', 'e2e'])(
    'signs in against the emulators in %s',
    (modus) => {
      expect(environmentFuer(modus)).toEqual(environment);
    }
  );
});
