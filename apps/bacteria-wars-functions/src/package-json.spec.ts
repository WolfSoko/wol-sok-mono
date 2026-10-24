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
