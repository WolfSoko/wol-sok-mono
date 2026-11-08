import { test as base } from '@playwright/test';
import { TeamPage } from '../pos/team.page';

/** `test` with the Team page's page object. */
export const test = base.extend<{ teamPage: TeamPage }>({
  teamPage: async ({ page }, use) => {
    await use(new TeamPage(page));
  },
});

export { expect } from '@playwright/test';
