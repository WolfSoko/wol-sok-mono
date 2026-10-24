import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * How the functions deploy (ADR 0011): only through their own `deploy`
 * target, which the release pipeline's non-cdk leg runs when a release
 * affects them. The game's hosting deploy never takes them along, no
 * hosting rewrite names one yet, the e2e emulators do not wait for their
 * build, and the deployed dependencies are pinned.
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

  it('deploys the functions by their own target, from the release pipeline', () => {
    expect(functionsProject.targets.deploy.options.command).toContain(
      '--only functions:bacteria'
    );
    expect(functionsProject.tags).not.toContain('deploy:manual');
    const deployWorkflow = read('.github/workflows/deploy.yml');
    const nonCdk = /app-type: non-cdk[\s\S]*?exclude-pattern: '([^']*)'/.exec(
      deployWorkflow
    );
    // The leg runs every deploy target whose project carries none of the
    // excluded tags - and excludes by tags only, no project by name.
    const excluded = nonCdk?.[1].split(',') ?? [];
    expect(excluded).toContain('tag:cdk');
    expect(excluded.filter((pattern) => !pattern.startsWith('tag:'))).toEqual(
      []
    );
    const tags: string[] = functionsProject.tags;
    expect(
      excluded.filter((pattern) => tags.includes(pattern.slice(4)))
    ).toEqual([]);
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
