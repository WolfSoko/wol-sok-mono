import { test as base } from '@playwright/test';
import { SpielPage } from '../pos/spiel.page';
import { StartPage } from '../pos/start.page';
import { TeamPage } from '../pos/team.page';

/** `test` with the page objects of the start, Team and Spiel pages. */
export const test = base.extend<{
  startPage: StartPage;
  teamPage: TeamPage;
  spielPage: SpielPage;
}>({
  startPage: async ({ page }, use) => {
    await use(new StartPage(page));
  },
  teamPage: async ({ page }, use) => {
    await use(new TeamPage(page));
  },
  spielPage: async ({ page }, use) => {
    await use(new SpielPage(page));
  },
});

export { expect } from '@playwright/test';
