import { test as base } from '@playwright/test';
import { StartPage } from '../pos/start.page';
import { TeamPage } from '../pos/team.page';

/** `test` with the page objects of the start page and the Team page. */
export const test = base.extend<{ startPage: StartPage; teamPage: TeamPage }>({
  startPage: async ({ page }, use) => {
    await use(new StartPage(page));
  },
  teamPage: async ({ page }, use) => {
    await use(new TeamPage(page));
  },
});

export { expect } from '@playwright/test';
