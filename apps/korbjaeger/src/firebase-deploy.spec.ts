// @vitest-environment node
import { readFileSync } from 'node:fs';

/** A file of the workspace, read as the deploy reads it. */
function workspaceJson<T>(path: string): T {
  return JSON.parse(
    readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8')
  ) as T;
}

interface FirebaseConfig {
  functions: { source: string; predeploy: string[] };
  hosting: {
    site?: string;
    public: string;
    rewrites: unknown[];
  };
}

interface ProjectJson {
  targets: Record<string, { options: { command: string } }>;
}

const config = workspaceJson<FirebaseConfig>('firebase.korbjaeger.json');

describe('the Firebase deploy', () => {
  it('deploys the root config, not the file Nitro generates in the app', () => {
    // apps/korbjaeger/firebase.json is Nitro's, with a placeholder site
    const project = workspaceJson<ProjectJson>('apps/korbjaeger/project.json');

    expect(project.targets['firebase'].options.command).toBe(
      'firebase --config=firebase.korbjaeger.json --project=korbjaeger'
    );
    expect(project.targets['deploy'].options.command).toBe(
      'nx run korbjaeger:firebase deploy'
    );
  });

  it("goes to the project's default site, named by .firebaserc alone", () => {
    const firebaserc = workspaceJson<{ projects: Record<string, string> }>(
      '.firebaserc'
    );

    expect(firebaserc.projects['korbjaeger']).toBeDefined();
    expect(config.hosting.site).toBeUndefined();
  });

  it("serves the build's public files and Nitro's server", () => {
    expect(config.hosting.public).toBe('dist/apps/korbjaeger/analog/public');
    expect(config.functions.source).toBe('dist/apps/korbjaeger/analog/server');
  });

  it('calls the function for the proxy only, every page comes from the CDN', () => {
    // ssr: false: each page is the one client-rendered shell
    expect(config.hosting.rewrites).toEqual([
      { source: '/api/**', function: 'server' },
      { source: '**', destination: '/index.html' },
    ]);
  });

  /**
   * Firebase runs the function's `predeploy` inside `npx nx`, which hands the
   * workspace's `.npmrc` (`legacy-peer-deps=true`) on as
   * `npm_config_legacy_peer_deps`. The lock file the install writes then
   * lacks required peers, and Cloud Build's plain `npm ci` refuses it. So
   * the install turns the setting off itself.
   */
  it('writes a lock file with the peers that npm ci in Cloud Build expects', () => {
    const installs = config.functions.predeploy.filter((command) =>
      /^npm .*\binstall\b/.test(command)
    );

    expect(installs).toHaveLength(1);
    expect(installs[0]).toContain('--legacy-peer-deps=false');
  });
});
