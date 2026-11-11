import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CLUB_INDEX_CRAWL_DAYS } from '@wolsok/feat-shared-korbjaeger-account';
import { CLUB_INDEX_DBB, CLUB_INDEX_SCHEDULE, REGION } from './config';

interface ProjectJson {
  targets: { deploy: { options: { commands: string[] } } };
}

const project = JSON.parse(
  readFileSync(join(__dirname, '../project.json'), 'utf8')
) as ProjectJson;

describe('the functions config', () => {
  // the deploy's images' cleanup policy belongs where the functions run
  it('sets the cleanup policy of the images in the functions’ region', () => {
    const [setPolicy] = project.targets.deploy.options.commands;

    expect(setPolicy).toContain('functions:artifacts:setpolicy');
    expect(setPolicy).toContain(`--location=${REGION} `);
  });
});

describe('the club index', () => {
  const site = readFileSync(
    join(__dirname, '../../korbjaeger/src/shared/site.ts'),
    'utf8'
  );

  // functions may import no app, so the URL is written out twice
  it('names the app’s URL in its User-Agent', () => {
    const [, siteUrl] = /SITE_URL = '([^']+)'/.exec(site) ?? [];

    expect(CLUB_INDEX_DBB.userAgent).toContain(`(+${siteUrl})`);
  });

  // a week of every Association's Leagues at one request a second
  it('waits a second between two calls and refreshes weekly', () => {
    expect(CLUB_INDEX_DBB.pauseMs).toBeGreaterThanOrEqual(1000);
    expect(CLUB_INDEX_SCHEDULE.maxAgeMs).toBe(7 * 86_400_000);
  });

  // #3022: a Verband without a list for a week gets a warning
  it('warns of a Verband that has had no list for a week', () => {
    expect(CLUB_INDEX_SCHEDULE.warnListlessAfterMs).toBe(7 * 86_400_000);
  });

  // the privacy policy renders the same days
  it('takes its days from the account lib', () => {
    expect(CLUB_INDEX_SCHEDULE.maxAgeMs).toBe(
      CLUB_INDEX_CRAWL_DAYS.maxAge * 86_400_000
    );
    expect(CLUB_INDEX_SCHEDULE.retryAfterMs).toBe(
      CLUB_INDEX_CRAWL_DAYS.retryAfter * 86_400_000
    );
  });
});
