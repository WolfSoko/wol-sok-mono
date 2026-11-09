// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';

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
    headers: { source: string; headers: { key: string; value: string }[] }[];
  };
}

interface ProjectJson {
  targets: Record<
    string,
    { options: { command?: string; commands?: string[]; parallel?: boolean } }
  >;
}

const config = workspaceJson<FirebaseConfig>('firebase.korbjaeger.json');

describe('the Firebase deploy', () => {
  it('deploys the root config, not the file Nitro generates in the app', () => {
    // apps/korbjaeger/firebase.json is Nitro's, with a placeholder site
    const project = workspaceJson<ProjectJson>('apps/korbjaeger/project.json');

    expect(project.targets['firebase'].options.command).toBe(
      'firebase --config=firebase.korbjaeger.json --project=korbjaeger'
    );
    expect(project.targets['deploy'].options.commands?.at(-1)).toBe(
      'nx run korbjaeger:firebase deploy'
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
    expect(commands).toEqual([
      `nx run korbjaeger:firebase functions:artifacts:setpolicy --location=${region} --days=1 --force`,
      'nx run korbjaeger:firebase deploy',
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
