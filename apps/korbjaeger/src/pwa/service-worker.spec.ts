// @vitest-environment node
import { readFileSync } from 'node:fs';

/** A file of the workspace, as the build or the deploy reads it. */
function workspaceFile(path: string): string {
  return readFileSync(new URL(`../../../../${path}`, import.meta.url), 'utf8');
}

interface AssetGroup {
  readonly name: string;
  readonly installMode: 'prefetch' | 'lazy';
  readonly resources: { readonly files: readonly string[] };
}

interface NgswConfig {
  readonly index: string;
  readonly navigationUrls?: readonly string[];
  readonly assetGroups: readonly AssetGroup[];
  readonly dataGroups?: readonly unknown[];
}

const config = JSON.parse(
  workspaceFile('apps/korbjaeger/ngsw-config.json')
) as NgswConfig;

/** Where Hosting serves the build from (`firebase.korbjaeger.json`). */
const HOSTING_PUBLIC = 'dist/apps/korbjaeger/analog/public';

/**
 * Angular's service worker (ngsw) keeps the app shell, so the app opens
 * without a network; the DBB's data is the app's own (`LokaleLetzteAntworten`)
 * and the CDN's, never the worker's.
 */
describe('service worker', () => {
  it('caches no read of the proxy: no data group, no asset under /api', () => {
    expect(config.dataGroups).toBeUndefined();
    const kept = config.assetGroups
      .flatMap((group) => group.resources.files)
      .filter((file) => !file.startsWith('!'));

    for (const file of kept) {
      // neither /api itself nor a glob over every path
      expect(file).not.toMatch(/^\/(api|\*\*)/);
    }
  });

  it('answers navigations with the shell, but leaves the proxy and files to the network', () => {
    expect(config.index).toBe('/index.html');
    expect(config.navigationUrls).toEqual([
      '/**',
      '!/**/*.*',
      '!/**/*__*',
      '!/**/*__*/**',
      '!/api',
      '!/api/**',
    ]);
  });

  it('keeps the whole shell at install, so every page opens offline', () => {
    const app = config.assetGroups.find((group) => group.name === 'app');

    expect(app?.installMode).toBe('prefetch');
    expect(app?.resources.files).toEqual(
      expect.arrayContaining([
        '/index.html',
        '/manifest.webmanifest',
        '/assets/*.js',
        '/assets/*.css',
      ])
    );
  });

  it('keeps no source map', () => {
    const files = config.assetGroups.flatMap((group) => group.resources.files);

    expect(files).toContain('!/**/*.map');
  });

  it('is built into what Hosting serves, from the hashed files of the build', () => {
    const project = JSON.parse(
      workspaceFile('apps/korbjaeger/project.json')
    ) as {
      targets: Record<
        string,
        { dependsOn?: string[]; options: { commands?: string[] } }
      >;
    };
    const build = project.targets['build'];

    expect(build.dependsOn).toEqual(['build-app']);
    expect(build.options.commands).toEqual([
      `cp node_modules/@angular/service-worker/ngsw-worker.js node_modules/@angular/service-worker/safety-worker.js ${HOSTING_PUBLIC}/`,
      `ngsw-config ${HOSTING_PUBLIC} apps/korbjaeger/ngsw-config.json /`,
    ]);
  });
});
