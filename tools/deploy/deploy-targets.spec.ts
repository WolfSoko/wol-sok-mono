import { describe, expect, it } from '@jest/globals';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const WORKSPACE = join(__dirname, '..', '..');

function workspaceJson<T>(path: string): T {
  return JSON.parse(readFileSync(join(WORKSPACE, path), 'utf8')) as T;
}

interface DeployTarget {
  options: { command?: string; commands?: string[]; parallel?: boolean };
}

/** The app of every root `firebase.<app>.json` that deploys Hosting. */
const HOSTING_APPS = readdirSync(WORKSPACE)
  .map((file) => /^firebase\.(.+)\.json$/.exec(file)?.[1])
  .filter((app): app is string => app !== undefined)
  .filter(
    (app) =>
      workspaceJson<{ hosting?: unknown }>(`firebase.${app}.json`).hosting !==
      undefined
  )
  .sort();

/**
 * The public domain visitors load each Hosting app from. Korbjäger's is also
 * held equal to its `SITE_URL` by the app's `firebase-deploy.spec.ts`.
 */
const PUBLIC_URLS: Record<string, string> = {
  'bacteria-game-remote': 'https://bacteria-wars.wolsok.de/',
  korbjaeger: 'https://korb.wolsok.de/',
  pacetrainer: 'https://pace-trainer.com/',
  'rollapolla-analog': 'https://rollapolla.com/',
};

describe('the Hosting deploys', () => {
  it('know the public domain of every Hosting config', () => {
    expect(HOSTING_APPS).toEqual(Object.keys(PUBLIC_URLS).sort());
  });

  it.each(HOSTING_APPS)(
    '%s deploys, then checks its domain serves the built index.html (#3073)',
    (app) => {
      const { targets } = workspaceJson<{
        targets: Record<string, DeployTarget>;
      }>(`apps/${app}/project.json`);
      const { commands, parallel } = targets['deploy'].options;

      expect(parallel).toBe(false);
      expect(commands?.at(-2)).toMatch(/firebase.* deploy/);
      expect(commands?.at(-1)).toBe(
        `tsx --tsconfig tools/tsconfig.tools.json tools/deploy/check-live-index.ts firebase.${app}.json ${PUBLIC_URLS[app]}`
      );
    }
  );
});
