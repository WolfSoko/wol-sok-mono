// @vitest-environment node
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
// what Firebase Hosting's emulator matches header rules with
import { configMatcher } from 'superstatic/lib/utils/patterns';
import { DELETED_ACCOUNTS_COLLECTION } from '@wolsok/feat-shared-korbjaeger-account';
import { FUNCTION_REGION } from './shared/function-region';
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
  functions: { codebase: string; source: string; predeploy: string[] }[];
  firestore?: { rules: string; indexes: string };
  hosting: {
    site?: string;
    public: string;
    rewrites: unknown[];
    headers: HeaderRule[];
  };
}

/** A Hosting header rule: a glob (`source`) or an RE2 `regex`. */
interface HeaderRule {
  source?: string;
  regex?: string;
  headers: { key: string; value: string }[];
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

/**
 * The function of codebase `name`: `default` is Nitro's server, which this
 * app deploys (`konto` is korbjaeger-functions').
 */
const codebase = (name: string) => {
  const found = config.functions.find((entry) => entry.codebase === name);
  if (found === undefined) {
    throw new Error(`firebase.korbjaeger.json has no codebase ${name}`);
  }
  return found;
};

const DEPLOY =
  'nx run korbjaeger:firebase deploy --only functions:default,hosting,firestore:rules,firestore:indexes';

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

  // DEPLOY, the deploy's last command, takes both (see below)
  it("deploys the app's Firestore rules and indexes with it, the ones its emulator specs test", () => {
    expect(config.firestore).toEqual({
      rules: 'apps/korbjaeger/firestore.rules',
      indexes: 'apps/korbjaeger/firestore.indexes.json',
    });
  });

  // the rules refuse a deleted account while its tombstone exists; the TTL
  // takes it away after a day (korbjaeger-functions, `kontoGeloescht`).
  // DEPLOY runs `firestore:indexes` without `--force`, so a TTL dropped from
  // the file stays live in Firestore (#2983: that of the tombstones of
  // before #2966, for the last ones written there)
  it("lets Firestore's TTL delete the deleted accounts' tombstones", () => {
    const indexes = workspaceJson<{
      fieldOverrides: {
        collectionGroup: string;
        fieldPath: string;
        ttl?: boolean;
      }[];
    }>('apps/korbjaeger/firestore.indexes.json');

    expect(indexes.fieldOverrides).toContainEqual(
      expect.objectContaining({
        collectionGroup: DELETED_ACCOUNTS_COLLECTION,
        fieldPath: 'expireAt',
        ttl: true,
      })
    );
  });

  // codebase konto is korbjaeger-functions', checked by its own spec; this
  // app's DEPLOY takes only `functions:default`
  it('shares the config with the codebase of korbjaeger-functions', () => {
    expect(config.functions.map((entry) => entry.codebase)).toEqual([
      'default',
      'konto',
    ]);
  });

  it('deploys the root config, not the file Nitro generates in the app', () => {
    // apps/korbjaeger/firebase.json is Nitro's, with a placeholder site
    const project = workspaceJson<ProjectJson>('apps/korbjaeger/project.json');

    expect(project.targets['firebase'].options.command).toBe(
      'firebase --config=firebase.korbjaeger.json --project=korbjaeger'
    );
    expect(project.targets['deploy'].options.commands?.at(-1)).toBe(DEPLOY);
  });

  /**
   * A deploy that creates or updates a function fails, after deploying it but
   * before releasing Hosting, when the function's Artifact Registry has no
   * cleanup policy (release 74.145.0). So the deploy sets one first, in the
   * function's region, keeping a day of images.
   */
  it("sets the images' cleanup policy in the function's region before deploying", () => {
    const project = workspaceJson<ProjectJson>('apps/korbjaeger/project.json');
    const region = FUNCTION_REGION.id;
    const { commands, parallel } = project.targets['deploy'].options;

    expect(
      readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8')
    ).toContain('region: FUNCTION_REGION.id');
    expect(parallel).toBe(false);
    expect(commands?.slice(1)).toEqual([
      `nx run korbjaeger:firebase functions:artifacts:setpolicy --location=${region} --days=1 --force`,
      DEPLOY,
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
    expect(codebase('default').source).toBe(
      'dist/apps/korbjaeger/analog/server'
    );
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
   * on every load (every path it answers, unknown ones too), so a reload
   * picks up the new release. Three globs name them, in the extglob the
   * rewrite uses: `/`, a single segment that is neither `api` nor a file,
   * and any deeper path not under `api` whose last segment is no file.
   */
  /** A path of each page file Analog routes (`src/app/pages`), ids as `1`. */
  function pagePaths(): string[] {
    const pages = new URL('./app/pages/', import.meta.url);
    return readdirSync(pages, { recursive: true, encoding: 'utf8' })
      .filter((file) => file.endsWith('.page.ts'))
      .map((file) =>
        file
          .replace(/\.page\.ts$/, '')
          .replace(/\(home\)$/, '')
          .replace(/\[[^\]]+\]/g, '1')
      )
      .map((route) => `/${route}`)
      .sort();
  }

  const cacheRules = config.hosting.headers.filter((rule) =>
    rule.headers.some(({ key }) => key.toLowerCase() === 'cache-control')
  );

  /** Whether Hosting sends `path` with `Cache-Control: no-cache`. */
  const revalidiert = (path: string): boolean =>
    cacheRules.some(
      (rule) =>
        configMatcher(path, rule) &&
        rule.headers.some(({ value }) => value === 'no-cache')
    );

  /**
   * The service worker's own files too: an old worker or manifest of the
   * cache would keep serving the release before.
   */
  const SERVICE_WORKER_FILES = [
    '/ngsw-worker.js',
    '/ngsw.json',
    '/safety-worker.js',
  ];

  it.each([
    ...pagePaths(),
    '/team/1',
    '/gibtsnicht',
    '/team/1/gibtsnicht',
    '/x/y.z/w',
    '/x.y/z',
    '/apix',
    '/a',
    '/index.html',
    ...SERVICE_WORKER_FILES,
  ])('revalidates %s, so none asks for chunks a release removed', (path) => {
    expect(revalidiert(path)).toBe(true);
  });

  /**
   * Hosting's header rules override what the function sends, and a
   * catch-all no-cache rule once turned the proxy's
   * `public, max-age=60, s-maxage=300` into `no-cache`, so the CDN cached
   * no DBB answer at all on its first live release. Hashed files keep
   * Hosting's caching.
   */
  it.each([
    '/api',
    '/api/dbb/x',
    '/api/dbb/team/313036/spiele',
    '/assets/a.js',
    '/main-ABC123.js',
    '/icons/icon-192.png',
  ])('leaves the caching of %s alone', (path) => {
    expect(cacheRules.filter((rule) => configMatcher(path, rule))).toEqual([]);
  });

  /**
   * Firebase runs the function's `predeploy` inside `npx nx`, which hands the
   * workspace's `.npmrc` (`legacy-peer-deps=true`) on as
   * `npm_config_legacy_peer_deps`. The lock file the install writes then
   * lacks required peers, and Cloud Build's plain `npm ci` refuses it. So
   * the install turns the setting off itself.
   */
  it('writes a lock file with the peers that npm ci in Cloud Build expects', () => {
    const installs = codebase('default').predeploy.filter((command) =>
      /^npm .*\binstall\b/.test(command)
    );

    expect(installs).toHaveLength(1);
    expect(installs[0]).toContain('--legacy-peer-deps=false');
  });
});
