import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// AdMob verifies the Android app's ad sellers through app-ads.txt at the root
// of the developer website its Play listing names (#3078).
const ADMOB_SELLER =
  'google.com, pub-6346271540341424, DIRECT, f08c47fec0942fa0';

interface EsbuildTarget {
  options: { assets: (string | { glob: string })[] };
}

describe('app-ads.txt of the game site', () => {
  it('holds exactly the AdMob seller line', () => {
    const file = readFileSync(join(__dirname, 'app-ads.txt'), 'utf8');
    expect(file).toBe(`${ADMOB_SELLER}\n`);
  });

  it('is shipped at the site root by the build', () => {
    const project = JSON.parse(
      readFileSync(join(__dirname, '../project.json'), 'utf8')
    ) as { targets: { esbuild: EsbuildTarget } };
    expect(project.targets.esbuild.options.assets).toContain(
      'apps/bacteria-game-remote/src/app-ads.txt'
    );
  });
});
