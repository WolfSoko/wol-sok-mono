import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (path: string) =>
  JSON.parse(readFileSync(join(__dirname, path), 'utf8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

describe('the deployed package.json', () => {
  // Cloud Build installs these for the deploy (`npm install --omit dev`):
  // the bundle takes them as they are in the workspace, and nothing else.
  it('names the Firebase packages and Sentry at the versions the workspace builds with', () => {
    const own = read('../package.json').dependencies ?? {};
    const root = read('../../../package.json');
    const workspace = { ...root.dependencies, ...root.devDependencies };
    expect(Object.keys(own).sort()).toEqual([
      '@sentry/node',
      'firebase-admin',
      'firebase-functions',
    ]);
    for (const [name, version] of Object.entries(own)) {
      expect(`${name}@${version}`).toBe(`${name}@${workspace[name]}`);
    }
  });
});

describe('the predeploy install', () => {
  // Firebase runs it inside `npx nx`, which hands the workspace's `.npmrc`
  // (`legacy-peer-deps=true`) on as `npm_config_legacy_peer_deps`. The lock
  // file would then lack required peers, and Cloud Build's plain `npm ci`
  // refuses such a lock, so the install turns the setting off itself.
  it('writes a lock file with the peers that npm ci in Cloud Build expects', () => {
    const { functions } = JSON.parse(
      readFileSync(
        join(__dirname, '../../../firebase.bacteria-game-remote.json'),
        'utf8'
      )
    ) as { functions: { codebase: string; predeploy: string[] }[] };
    const bacteria = functions.find(({ codebase }) => codebase === 'bacteria');
    expect(bacteria?.predeploy).toEqual([
      'npm --prefix "$RESOURCE_DIR" install --omit dev --legacy-peer-deps=false',
    ]);
  });
});
