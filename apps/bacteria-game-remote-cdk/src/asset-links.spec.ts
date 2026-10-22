import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The Android app (apps/bacteria-game-android) shows the site this stack
// deploys fullscreen only while the site's asset links
// (apps/bacteria-game-remote) name the app, so all three have to agree. The
// stack depends on both projects, so a change to any of them runs this spec.
const workspaceRoot = join(__dirname, '../../..');

function read(path: string): string {
  return readFileSync(join(workspaceRoot, path), 'utf8');
}

const gradle = read('apps/bacteria-game-android/app/build.gradle.kts');
const cdkStack = read('apps/bacteria-game-remote-cdk/src/main.ts');
const assetLinks: unknown = JSON.parse(
  read('apps/bacteria-game-remote/src/.well-known/assetlinks.json')
);

/** The string a Kotlin assignment such as `val host = "..."` gives. */
function gradleString(name: string): string {
  const value = new RegExp(`${name} = "([^"]+)"`).exec(gradle)?.[1];
  if (value == null) {
    throw new Error(`${name} not found in build.gradle.kts`);
  }
  return value;
}

describe('asset links for the Android app', () => {
  it('let the app with the package name from the Gradle build handle links', () => {
    expect(assetLinks).toEqual([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: gradleString('applicationId'),
          sha256_cert_fingerprints: expect.any(Array),
        },
      },
    ]);
  });

  it('list SHA-256 fingerprints the way keytool prints them', () => {
    const [{ target }] = assetLinks as Array<{
      target: { sha256_cert_fingerprints: string[] };
    }>;
    for (const fingerprint of target.sha256_cert_fingerprints) {
      expect(fingerprint).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
    }
  });

  it('are deployed to the host the app opens', () => {
    expect(cdkStack).toContain(`domainName: '${gradleString('val host')}'`);
  });
});
