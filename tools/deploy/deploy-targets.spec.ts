import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const WORKSPACE = join(__dirname, '..', '..');

interface DeployTarget {
  options: { command?: string; commands?: string[]; parallel?: boolean };
}

function deployOf(app: string): DeployTarget {
  const project = JSON.parse(
    readFileSync(join(WORKSPACE, 'apps', app, 'project.json'), 'utf8')
  ) as { targets: Record<string, DeployTarget> };
  return project.targets['deploy'];
}

/**
 * Every app that deploys to Firebase Hosting, with its root config and the
 * public domain visitors load it from.
 */
const HOSTING_DEPLOYS = [
  ['korbjaeger', 'https://korb.wolsok.de/'],
  ['bacteria-game-remote', 'https://bacteria-wars.wolsok.de/'],
  ['pacetrainer', 'https://pace-trainer.com/'],
  ['rollapolla-analog', 'https://rollapolla.com/'],
] as const;

describe('the Hosting deploys', () => {
  it.each(HOSTING_DEPLOYS)(
    '%s ends with the live index check on its config and domain (#3073)',
    (app, siteUrl) => {
      const { commands, parallel } = deployOf(app).options;

      expect(parallel).toBe(false);
      expect(commands?.at(-1)).toBe(
        `tsx --tsconfig tools/tsconfig.tools.json tools/deploy/check-live-index.ts firebase.${app}.json ${siteUrl}`
      );
    }
  );

  it.each(HOSTING_DEPLOYS)('%s deploys before it checks', (app, _siteUrl) => {
    const { commands = [] } = deployOf(app).options;

    expect(commands.at(-2)).toMatch(/firebase.* deploy/);
  });
});
