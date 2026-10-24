import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Keeps the functions out of every deploy but their own, until the owner
 * has done the manual steps of ADR 0011 (Blaze, region, IAM): the game's
 * hosting deploy never takes them along, no hosting rewrite names one yet,
 * the release pipeline skips their deploy target, and the e2e emulators do
 * not wait for their build.
 */

const ROOT = join(__dirname, '../../..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const json = (path: string) => JSON.parse(read(path));
const byName = (a: string, b: string) => a.localeCompare(b);

const firebaseConfig = json('firebase.bacteria-game-remote.json');
const functionsProject = json('apps/bacteria-wars-functions/project.json');
const remoteProject = json('apps/bacteria-game-remote/project.json');

describe('deploy safety', () => {
  it('deploys the functions as codebase bacteria from their build', () => {
    expect(firebaseConfig.functions).toEqual([
      expect.objectContaining({
        codebase: 'bacteria',
        source: functionsProject.targets.build.options.outputPath,
      }),
    ]);
    expect(firebaseConfig.emulators.functions).toEqual({ port: 5401 });
  });

  it('lets no hosting rewrite name a function yet', () => {
    const rewrites: Record<string, unknown>[] = firebaseConfig.hosting.rewrites;
    expect(rewrites.filter((rewrite) => 'function' in rewrite)).toEqual([]);
    expect(rewrites.filter((rewrite) => 'run' in rewrite)).toEqual([]);
  });

  it('keeps functions out of the game remote deploy and its e2e emulators', () => {
    expect(remoteProject.targets.deploy.options.command).toContain(
      '--only hosting,firestore,database'
    );
    expect(
      remoteProject.targets['firebase-emulators'].options.command
    ).toContain('--only auth,firestore,database ');
  });

  it('deploys the functions only by their own target, which the release skips', () => {
    expect(functionsProject.targets.deploy.options.command).toContain(
      '--only functions:bacteria'
    );
    expect(functionsProject.tags).toContain('deploy:manual');
    const deployWorkflow = read('.github/workflows/deploy.yml');
    const nonCdk = /app-type: non-cdk[\s\S]*?exclude-pattern: '([^']*)'/.exec(
      deployWorkflow
    );
    expect(nonCdk?.[1].split(',')).toContain('tag:deploy:manual');
  });

  it('pins the deployed dependencies to the workspace versions', () => {
    const app = json('apps/bacteria-wars-functions/package.json');
    const root = json('package.json');
    const workspace = { ...root.devDependencies, ...root.dependencies };
    for (const [name, version] of Object.entries(app.dependencies)) {
      expect([name, version]).toEqual([name, workspace[name]]);
    }
    expect(app.engines.node).toBe('22');
    expect(
      [...functionsProject.targets.build.options.esbuildOptions.external].sort(
        byName
      )
    ).toEqual(Object.keys(app.dependencies).sort(byName));
  });
});
