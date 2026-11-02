import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SUPPORT_DEFAULTS } from './environments/game-support';

// The Android app (apps/bacteria-wars-android) reads its package name from
// this file and gets fullscreen only while the file names its signing keys.
interface AssetLink {
  relation: string[];
  target: {
    namespace: string;
    package_name: string;
    sha256_cert_fingerprints: string[];
  };
}

const assetLinks = JSON.parse(
  readFileSync(join(__dirname, '.well-known/assetlinks.json'), 'utf8')
) as AssetLink[];

describe('asset links for the Android app', () => {
  it('let one Android app handle links to the site', () => {
    expect(assetLinks).toEqual([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: expect.stringMatching(/^[a-z]\w*(\.[a-z]\w*)+$/),
          sha256_cert_fingerprints: expect.any(Array),
        },
      },
    ]);
  });

  it('list SHA-256 fingerprints the way keytool prints them', () => {
    for (const fingerprint of assetLinks[0].target.sha256_cert_fingerprints) {
      expect(fingerprint).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
    }
  });

  it('name the package the game tells the app by', () => {
    expect(assetLinks[0].target.package_name).toBe(
      SUPPORT_DEFAULTS.androidPackage
    );
  });
});
