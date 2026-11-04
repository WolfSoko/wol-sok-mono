import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { releaseName, WORKSPACE_VERSION } from './version';

function versionFromFile(): string {
  const file = join(__dirname, '../../../../version.json');
  return (JSON.parse(readFileSync(file, 'utf8')) as { version: string })
    .version;
}

describe('WORKSPACE_VERSION', () => {
  it('is the version in the root version.json', () => {
    expect(WORKSPACE_VERSION).toBe(versionFromFile());
  });

  it('is a semantic version', () => {
    expect(WORKSPACE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('releaseName', () => {
  it('names the release after the project and the version tag', () => {
    expect(releaseName('bacteria-wars')).toBe(
      `bacteria-wars@v${versionFromFile()}`
    );
  });
});
