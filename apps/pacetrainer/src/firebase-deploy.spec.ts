import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Firebase runs the function's `predeploy` inside `npx nx`, which hands the
 * workspace's `.npmrc` (`legacy-peer-deps=true`) on as
 * `npm_config_legacy_peer_deps`. The lock file the install writes then lacks
 * the required peers (of `@analogjs/content`: `marked-highlight`, `prismjs`),
 * and Cloud Build's plain `npm ci` refuses it. So the install turns the
 * setting off itself.
 */
const config = JSON.parse(
  readFileSync(join(__dirname, '../../../firebase.pacetrainer.json'), 'utf8')
) as { functions: FunctionsConfig | FunctionsConfig[] };

interface FunctionsConfig {
  predeploy: string[];
}

describe('the SSR function deploy', () => {
  it('writes a lock file with the peers that npm ci in Cloud Build expects', () => {
    const installs = [config.functions]
      .flat()
      .flatMap((functions) => functions.predeploy)
      .filter((command) => /^npm .*\binstall\b/.test(command));
    expect(installs).toHaveLength(1);
    expect(installs[0]).toContain('--legacy-peer-deps=false');
  });
});
