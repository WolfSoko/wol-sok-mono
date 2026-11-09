// @vitest-environment node
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  assertDeployableBuild,
  buildKonfigurationMerken,
  recordBuildConfiguration,
} from '../deploy/build-configuration';

const WORKSPACE = fileURLToPath(new URL('../../../', import.meta.url));

/** A file of the workspace, read as the deploy reads it. */
function workspaceJson<T>(path: string): T {
  return JSON.parse(
    readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8')
  ) as T;
}

interface FirebaseConfig {
  functions: { source: string; predeploy: string[] };
  firestore?: { rules: string };
  hosting: {
    site?: string;
    public: string;
    rewrites: unknown[];
    headers: { source: string; headers: { key: string; value: string }[] }[];
  };
}

interface ProjectJson {
  targets: Record<
    string,
    {
      options: { command?: string; commands?: string[]; parallel?: boolean };
      dependsOn?: unknown[];
      configurations?: Record<string, unknown>;
      outputs?: string[];
      defaultConfiguration?: string;
    }
  >;
}

const config = workspaceJson<FirebaseConfig>('firebase.korbjaeger.json');

describe('the Firebase deploy', () => {
  // a development or e2e build offers the sign-in and talks to the local
  // emulators (environment.ts): only a production build may go live. Nx hands
  // `deploy -c development` on to the build, so the deploy checks what it got
  describe('only a production build', () => {
    const CHECK =
      'tsx ./apps/korbjaeger/deploy/build-configuration.ts check dist/apps/korbjaeger';
    let dist: string;

    beforeEach(() => {
      dist = mkdtempSync(join(tmpdir(), 'korbjaeger-dist-'));
    });

    afterEach(() => rmSync(dist, { recursive: true, force: true }));

    it('is built by default, and checked before anything is deployed', () => {
      const { targets } = workspaceJson<ProjectJson>(
        'apps/korbjaeger/project.json'
      );

      expect(targets['deploy'].dependsOn).toEqual(['build']);
      expect(targets['deploy'].options.commands?.[0]).toBe(CHECK);
      expect(targets['build'].defaultConfiguration).toBe('production');
      expect(targets['build-app'].defaultConfiguration).toBe('production');
    });

    it('is recorded by build-app with the artifacts it builds, so its cache holds it too', () => {
      const { targets } = workspaceJson<ProjectJson>(
        'apps/korbjaeger/project.json'
      );

      expect(targets['build-app'].outputs).toContain(
        '{workspaceRoot}/dist/{projectRoot}/build-configuration'
      );
      // `build` only adds the service worker; it records nothing itself
      expect(JSON.stringify(targets['build'])).not.toContain(
        'build-configuration'
      );
    });

    it('records the mode the build ran in once Vite wrote the build', () => {
      const plugin = buildKonfigurationMerken(dist);

      (plugin.configResolved as (c: { mode: string }) => void)({
        mode: 'development',
      });
      (plugin.writeBundle as () => void)();

      expect(() => assertDeployableBuild(dist)).toThrow(
        'Refusing to deploy a "development" build of Korbjäger'
      );
    });

    it.each([
      ['production', 0],
      ['development', 1],
    ])(
      'lets the deploy command go on only for a %s build',
      (konfiguration, code) => {
        recordBuildConfiguration(dist, konfiguration);

        const pruefung = spawnSync(
          'npx',
          [
            'tsx',
            './apps/korbjaeger/deploy/build-configuration.ts',
            'check',
            dist,
          ],
          { cwd: WORKSPACE, encoding: 'utf8' }
        );

        expect(pruefung.status).toBe(code);
      }
    );

    it('goes live', () => {
      recordBuildConfiguration(dist, 'production');

      expect(() => assertDeployableBuild(dist)).not.toThrow();
    });

    it.each(['development', 'e2e'])('refuses a %s build', (configuration) => {
      recordBuildConfiguration(dist, configuration);

      expect(() => assertDeployableBuild(dist)).toThrow(
        `Refusing to deploy a "${configuration}" build of Korbjäger`
      );
    });

    it('refuses a build that recorded nothing', () => {
      expect(() => assertDeployableBuild(dist)).toThrow(
        'Refusing to deploy a "unknown" build of Korbjäger'
      );
    });
  });

  it("deploys the app's Firestore rules with it, the ones its emulator specs test", () => {
    const config = workspaceJson<FirebaseConfig>('firebase.korbjaeger.json');
    const { commands } = workspaceJson<ProjectJson>(
      'apps/korbjaeger/project.json'
    ).targets['deploy'].options;

    expect(config.firestore).toEqual({
      rules: 'apps/korbjaeger/firestore.rules',
    });
    expect(commands?.at(-1)).toContain('firestore:rules');
  });

  it('deploys the root config, not the file Nitro generates in the app', () => {
    // apps/korbjaeger/firebase.json is Nitro's, with a placeholder site
    const project = workspaceJson<ProjectJson>('apps/korbjaeger/project.json');

    expect(project.targets['firebase'].options.command).toBe(
      'firebase --config=firebase.korbjaeger.json --project=korbjaeger'
    );
    expect(project.targets['deploy'].options.commands?.at(-1)).toBe(
      'nx run korbjaeger:firebase deploy --only functions,hosting,firestore:rules'
    );
  });

  /**
   * A deploy that creates or updates a function fails, after deploying it but
   * before releasing Hosting, when the function's Artifact Registry has no
   * cleanup policy (release 74.145.0). So the deploy sets one first, in the
   * function's region, keeping a day of images.
   */
  it("sets the images' cleanup policy in the function's region before deploying", () => {
    const project = workspaceJson<ProjectJson>('apps/korbjaeger/project.json');
    const region = /region: '([a-z0-9-]+)'/.exec(
      readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8')
    )?.[1];
    const { commands, parallel } = project.targets['deploy'].options;

    expect(region).toBeDefined();
    expect(parallel).toBe(false);
    expect(commands?.slice(1)).toEqual([
      `nx run korbjaeger:firebase functions:artifacts:setpolicy --location=${region} --days=1 --force`,
      'nx run korbjaeger:firebase deploy --only functions,hosting,firestore:rules',
    ]);
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
      { source: '**/!(*.*)', destination: '/index.html' },
    ]);
  });

  /**
   * A tab opened before a release still asks for the old hashed chunks. Only
   * paths without a file extension fall back to the shell, so a chunk that
   * is gone answers 404 instead of HTML, and the shell itself is revalidated
   * on every load, so a reload picks up the new release.
   */
  /** The Hosting path of each page file Analog routes (`src/app/pages`). */
  function pagePaths(): string[] {
    const pages = new URL('./app/pages/', import.meta.url);
    return readdirSync(pages, { recursive: true, encoding: 'utf8' })
      .filter((file) => file.endsWith('.page.ts'))
      .map((file) =>
        file
          .replace(/\.page\.ts$/, '')
          .replace(/\(home\)$/, '')
          .replace(/\[[^\]]+\]/g, '*')
      )
      .map((route) => `/${route}`)
      .sort();
  }

  const noCacheSources = () =>
    config.hosting.headers
      .filter((rule) =>
        rule.headers.some(
          ({ key, value }) => key === 'Cache-Control' && value === 'no-cache'
        )
      )
      .map((rule) => rule.source)
      .sort();

  /**
   * The service worker's own files too: an old worker or manifest of the
   * cache would keep serving the release before.
   */
  const SERVICE_WORKER_FILES = [
    '/ngsw-worker.js',
    '/ngsw.json',
    '/safety-worker.js',
  ];

  it('revalidates the shell on every page and the service worker, so none asks for chunks a release removed', () => {
    expect(noCacheSources()).toEqual(
      [...pagePaths(), '/index.html', ...SERVICE_WORKER_FILES].sort()
    );
  });

  /**
   * Hosting's header rules override what the function sends, and a
   * catch-all no-cache rule once turned the proxy's
   * `public, max-age=60, s-maxage=300` into `no-cache`, so the CDN cached
   * no DBB answer at all on its first live release.
   */
  it("leaves the proxy's Cache-Control to the function", () => {
    const cacheRules = config.hosting.headers.filter((rule) =>
      rule.headers.some(({ key }) => key.toLowerCase() === 'cache-control')
    );

    for (const { source } of cacheRules) {
      expect(source.startsWith('/api')).toBe(false);
      expect(source).not.toContain('**');
    }
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
