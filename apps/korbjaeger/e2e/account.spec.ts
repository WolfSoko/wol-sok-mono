import { hasSelection, uidOf } from './fixtures/emulators';
import { SettingsPage } from './pos/settings.page';
import { StartPage } from './pos/start.page';
import { TeamPage } from './pos/team.page';
import { expect, test } from './fixtures/pages.fixture';

const MTV_WASBUETTEL = 313036;

/** A new account of the Auth emulator per run, so reruns start empty. */
function newAccount(name: string) {
  return {
    email: `${name.toLowerCase()}-${Date.now()}@example.com`,
    name: `Familie ${name}`,
  };
}

/*
 * Sign-in through the Auth and Firestore emulators (`korbjaeger:emulatoren`).
 * The clock is left alone: Auth's tokens carry the real time.
 */
test.describe('the account', () => {
  test('keeps Meine Teams the same on a second device signed in with it', async ({
    page,
    browser,
    startPage,
    teamPage,
    settingsPage,
  }) => {
    const account = newAccount('Muster');
    await teamPage.goto(MTV_WASBUETTEL);
    await teamPage.follow.click();
    await expect(teamPage.unfollow).toBeVisible();

    await page.getByRole('link', { name: 'Einstellungen' }).click();
    await settingsPage.signInAs(account, { freshAccount: true });
    await expect(settingsPage.accountName).toHaveText(
      'Angemeldet als Familie Muster'
    );
    await startPage.goto();
    await expect(startPage.team('MTV Wasbüttel')).toBeVisible();

    const secondDevice = await browser.newContext();
    const secondPage = await secondDevice.newPage();
    const secondSettings = new SettingsPage(secondPage);
    const secondStart = new StartPage(secondPage);
    await secondStart.goto();
    await expect(secondStart.empty).toBeVisible();
    await secondSettings.goto();
    await secondSettings.signInAs(account, { freshAccount: false });
    await expect(secondSettings.accountName).toHaveText(
      'Angemeldet als Familie Muster'
    );
    await secondStart.goto();
    await expect(secondStart.team('MTV Wasbüttel')).toBeVisible();

    // what one device changes shows on the other
    const secondTeam = new TeamPage(secondPage);
    await secondTeam.goto(MTV_WASBUETTEL);
    await secondTeam.unfollow.click();
    await expect(secondTeam.follow).toBeVisible();
    await startPage.goto();
    await expect(startPage.empty).toBeVisible();

    await secondSettings.goto();
    await secondSettings.signOut.click();
    await expect(secondSettings.signIn).toBeVisible();
    await secondStart.goto();
    await expect(secondStart.empty).toBeVisible();
    await secondDevice.close();
  });

  test('deletes the account and its choices', async ({
    page,
    request,
    startPage,
    teamPage,
    settingsPage,
  }) => {
    await teamPage.goto(MTV_WASBUETTEL);
    await teamPage.follow.click();
    await expect(teamPage.unfollow).toBeVisible();
    await settingsPage.goto();
    const account = newAccount('Beispiel');
    await settingsPage.signInAs(account, { freshAccount: true });
    await expect(settingsPage.accountName).toBeVisible();
    const uid = await uidOf(request, account.email);
    expect(uid).toBeDefined();
    expect(await hasSelection(request, uid as string)).toBe(true);

    await settingsPage.deleteAccount(account);

    await expect(settingsPage.signIn).toBeVisible();
    // gone in the emulators too: the account and its document
    expect(await uidOf(request, account.email)).toBeUndefined();
    expect(await hasSelection(request, uid as string)).toBe(false);
    await startPage.goto();
    await expect(startPage.empty).toBeVisible();
    await page.reload();
    await expect(startPage.empty).toBeVisible();
  });
});
