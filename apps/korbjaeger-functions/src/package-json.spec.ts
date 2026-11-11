import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REGION } from './config';

/** A JSON file, by its path from this folder. */
const json = <T>(path: string): T =>
  JSON.parse(readFileSync(join(__dirname, path), 'utf8')) as T;

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

describe('the deployed package.json', () => {
  // Cloud Build installs these for the deploy (`npm install --omit dev`):
  // the bundle takes them as they are in the workspace, and nothing else.
  it('names the Firebase packages at the versions the workspace builds with', () => {
    const own = json<PackageJson>('../package.json').dependencies ?? {};
    const root = json<PackageJson>('../../../package.json');
    const workspace = { ...root.dependencies, ...root.devDependencies };
    expect(Object.keys(own).sort()).toEqual([
      'firebase-admin',
      'firebase-functions',
    ]);
    for (const [name, version] of Object.entries(own)) {
      expect(`${name}@${version}`).toBe(`${name}@${workspace[name]}`);
    }
  });
});

describe('the deploy', () => {
  const firebase = json<{
    functions: { codebase: string; source: string; predeploy: string[] }[];
  }>('../../../firebase.korbjaeger.json');
  const konto = firebase.functions.find(({ codebase }) => codebase === 'konto');

  it('takes this build as codebase konto, beside the Nitro server', () => {
    expect(konto?.source).toBe('dist/apps/korbjaeger-functions');
  });

  // Firebase runs it inside `npx nx`, which hands the workspace's `.npmrc`
  // (`legacy-peer-deps=true`) on as `npm_config_legacy_peer_deps`. The lock
  // file would then lack required peers, and Cloud Build's plain `npm ci`
  // refuses such a lock, so the install turns the setting off itself.
  it('writes a lock file with the peers that npm ci in Cloud Build expects', () => {
    expect(konto?.predeploy).toEqual([
      'npm --prefix "$RESOURCE_DIR" install --omit dev --legacy-peer-deps=false',
    ]);
  });

  // `--force` deletes functions of the codebase gone from main.ts; the
  // images' cleanup policy goes first, as a function's deploy fails without
  // one in its region (release 74.145.0)
  it('deploys only codebase konto, in the functions region', () => {
    const { targets } = json<{
      targets: Record<
        string,
        {
          dependsOn?: string[];
          options: { commands: string[]; parallel: boolean };
        }
      >;
    }>('../project.json');

    expect(targets['deploy'].dependsOn).toEqual(['build']);
    expect(targets['deploy'].options.parallel).toBe(false);
    // each call to Google's API runs through the one-retry helper (#2946)
    const retried =
      'tsx --tsconfig tools/tsconfig.tools.json tools/deploy/retry-once.ts';
    expect(targets['deploy'].options.commands).toEqual([
      `${retried} firebase --config=firebase.korbjaeger.json --project=korbjaeger functions:artifacts:setpolicy --location=${REGION} --days=1 --force`,
      `${retried} firebase deploy --config=firebase.korbjaeger.json --project=korbjaeger --only functions:konto --force --non-interactive`,
    ]);
  });
});
