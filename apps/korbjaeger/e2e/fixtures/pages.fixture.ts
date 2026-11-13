import { test as base } from '@playwright/test';
import { SettingsPage } from '../pos/settings.page';
import { GamePage } from '../pos/game.page';
import { StartPage } from '../pos/start.page';
import { SearchPage } from '../pos/search.page';
import { TeamSetupPage } from '../pos/team-setup.page';
import { TeamPage } from '../pos/team.page';
import { TitleBar } from '../pos/title-bar';

/**
 * `test` with the page objects of the start, search, wizard, Team, Spiel
 * and settings pages, and of the title bar above them.
 */
export const test = base.extend<{
  startPage: StartPage;
  searchPage: SearchPage;
  teamSetupPage: TeamSetupPage;
  teamPage: TeamPage;
  gamePage: GamePage;
  settingsPage: SettingsPage;
  titleBar: TitleBar;
}>({
  startPage: async ({ page }, use) => {
    await use(new StartPage(page));
  },
  searchPage: async ({ page }, use) => {
    await use(new SearchPage(page));
  },
  teamSetupPage: async ({ page }, use) => {
    await use(new TeamSetupPage(page));
  },
  teamPage: async ({ page }, use) => {
    await use(new TeamPage(page));
  },
  gamePage: async ({ page }, use) => {
    await use(new GamePage(page));
  },
  settingsPage: async ({ page }, use) => {
    await use(new SettingsPage(page));
  },
  titleBar: async ({ page }, use) => {
    await use(new TitleBar(page));
  },
});

export { expect } from '@playwright/test';
