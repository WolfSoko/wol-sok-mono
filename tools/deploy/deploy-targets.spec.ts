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

/** The one-retry helper every Firebase CLI call of a deploy runs through. */
const RETRIED =
  'tsx --tsconfig tools/tsconfig.tools.json tools/deploy/retry-once.ts';

/** Escapes `text` for use as a literal in a regular expression. */
function literal(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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
      expect(commands?.at(-2)).toMatch(
        new RegExp(
          `^${literal(`${RETRIED} firebase --config=firebase.${app}.json --project=${app} deploy`)}( |$)`
        )
      );
      expect(commands?.at(-1)).toBe(
        `tsx --tsconfig tools/tsconfig.tools.json tools/deploy/check-live-index.ts firebase.${app}.json ${PUBLIC_URLS[app]}`
      );
    }
  );

  // a single transient error of Google's API must not fail the release, so
  // the deploy calls the CLI itself through the helper (#3034): a nested
  // `nx run <app>:firebase` in the same release failed every functions deploy
  it.each(HOSTING_APPS)('%s runs no nested Nx task', (app) => {
    const { targets } = workspaceJson<{
      targets: Record<string, DeployTarget>;
    }>(`apps/${app}/project.json`);
    const { command, commands } = targets['deploy'].options;

    for (const line of [command, ...(commands ?? [])]) {
      expect(line ?? '').not.toMatch(/\bnx run\b/);
    }
  });
});
