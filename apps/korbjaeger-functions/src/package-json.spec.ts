import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REGION } from './config';

const read = (path: string) =>
  JSON.parse(readFileSync(join(__dirname, path), 'utf8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

describe('the deployed package.json', () => {
  // Cloud Build installs these for the deploy (`npm install --omit dev`):
  // the bundle takes them as they are in the workspace, and nothing else.
  it('names the Firebase packages at the versions the workspace builds with', () => {
    const own = read('../package.json').dependencies ?? {};
    const root = read('../../../package.json');
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
  const firebase = JSON.parse(
    readFileSync(join(__dirname, '../../../firebase.korbjaeger.json'), 'utf8')
  ) as {
    functions: { codebase: string; source: string; predeploy: string[] }[];
  };
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
    const { targets } = JSON.parse(
      readFileSync(join(__dirname, '../project.json'), 'utf8')
    ) as {
      targets: Record<
        string,
        {
          dependsOn?: string[];
          options: { commands: string[]; parallel: boolean };
        }
      >;
    };

    expect(targets['deploy'].dependsOn).toEqual(['build']);
    expect(targets['deploy'].options.parallel).toBe(false);
    expect(targets['deploy'].options.commands).toEqual([
      `firebase --config=firebase.korbjaeger.json --project=korbjaeger functions:artifacts:setpolicy --location=${REGION} --days=1 --force`,
      'firebase deploy --config=firebase.korbjaeger.json --project=korbjaeger --only functions:konto --force --non-interactive',
    ]);
  });
});
