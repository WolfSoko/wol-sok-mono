import { test as base } from '@playwright/test';
import { EinstellungenPage } from '../pos/einstellungen.page';
import { SpielPage } from '../pos/spiel.page';
import { StartPage } from '../pos/start.page';
import { SuchePage } from '../pos/suche.page';
import { TeamEinrichtenPage } from '../pos/team-einrichten.page';
import { TeamPage } from '../pos/team.page';
import { TitleBar } from '../pos/title-bar';

/**
 * `test` with the page objects of the start, wizard, search, Team, Spiel
 * and settings pages, and of the title bar above them.
 */
export const test = base.extend<{
  startPage: StartPage;
  teamEinrichtenPage: TeamEinrichtenPage;
  teamPage: TeamPage;
  spielPage: SpielPage;
  einstellungenPage: EinstellungenPage;
  suchePage: SuchePage;
  titleBar: TitleBar;
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
  suchePage: async ({ page }, use) => {
    await use(new SuchePage(page));
  },
  titleBar: async ({ page }, use) => {
    await use(new TitleBar(page));
  },
});

export { expect } from '@playwright/test';
