import { test as base } from '@playwright/test';
import { EinstellungenPage } from '../pos/einstellungen.page';
import { SpielPage } from '../pos/spiel.page';
import { StartPage } from '../pos/start.page';
import { TeamEinrichtenPage } from '../pos/team-einrichten.page';
import { TeamPage } from '../pos/team.page';

/**
 * `test` with the page objects of the start, wizard, Team, Spiel and
 * settings pages.
 */
export const test = base.extend<{
  startPage: StartPage;
  teamEinrichtenPage: TeamEinrichtenPage;
  teamPage: TeamPage;
  spielPage: SpielPage;
  einstellungenPage: EinstellungenPage;
}>({
  startPage: async ({ page }, use) => {
    await use(new StartPage(page));
  },
  teamEinrichtenPage: async ({ page }, use) => {
    await use(new TeamEinrichtenPage(page));
  },
  teamPage: async ({ page }, use) => {
    await use(new TeamPage(page));
  },
  spielPage: async ({ page }, use) => {
    await use(new SpielPage(page));
  },
  einstellungenPage: async ({ page }, use) => {
    await use(new EinstellungenPage(page));
  },
});

export { expect } from '@playwright/test';
