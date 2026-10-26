import { expect as baseExpect, Page, test } from '@playwright/test';
import { AccountPo, uniqueEmail } from './pos/account.po';
import { BacteriaGamePo } from './pos/bacteria-game.po';

// The game runs against the Firebase emulators (environment.e2e.ts): every
// browser context is a new guest, and every test signs in to accounts of
// its own, so the tests share the emulators without meeting.

// What the cloud keeps shows once the guest is signed in and Firestore has
// answered, while the game still renders its start: seconds on a busy agent.
const expect = baseExpect.configure({ timeout: 15_000 });

/** The daily level's card in a new game, with the attempts left today. */
function dailyCard(page: Page) {
  return page
    .locator('feat-lazy-bac-game-new-game .mode')
    .filter({ hasText: 'Daily level' });
}

/**
 * Starts the daily level and quits it - an attempt counts as the match
 * starts - and is back on the main menu.
 */
async function useDailyAttempt(po: BacteriaGamePo, page: Page): Promise<void> {
  await po.playCta.click();
  // The daily level picks its level itself: straight on to the start.
  await po.chooseMode('Daily level');
  // A ranked match has no pause menu and needs a GPU that passed the
  // self-test: play the practice match, an attempt of the menu all the same.
  const ranked = page.getByRole('switch', { name: 'Ranked attempt' });
  // The offer is read asynchronously: give the switch time to appear.
  await ranked.waitFor({ timeout: 15_000 }).catch(() => undefined);
  if ((await ranked.count()) > 0 && (await ranked.isEnabled())) {
    if ((await ranked.getAttribute('aria-checked')) === 'true') {
      await ranked.click();
      await expect(ranked).toHaveAttribute('aria-checked', 'false');
    }
  }
  await po.startCta.click();
  await po.pauseCta.click();
  await po.quitCta.click();
  // The arena is vaporized first, which takes a few seconds.
  await expect(po.playCta).toBeVisible({ timeout: 30_000 });
}

/** Expects the attempts left at the daily level, then back to the menu. */
async function expectAttemptsLeft(
  po: BacteriaGamePo,
  page: Page,
  left: number
): Promise<void> {
  await po.playCta.click();
  await expect(dailyCard(page)).toContainText(`${left} of 3 attempts left`);
  await po.backCta.click();
}

async function openProfile(page: Page): Promise<AccountPo> {
  await page.getByRole('button', { name: 'Profile' }).click();
  const account = new AccountPo(page);
  await expect(account.account).toBeVisible();
  return account;
}

test.describe('cloud save', () => {
  test('should keep a guest’s progress across visits', async ({ page }) => {
    const po = new BacteriaGamePo(page);
    await po.goto();

    const account = await openProfile(page);
    await expect(account.account).toContainText('Playing as a guest');
    await po.backCta.click();
    await useDailyAttempt(po, page);
    await expectAttemptsLeft(po, page, 2);

    await page.reload();

    await expectAttemptsLeft(po, page, 2);
  });

  test('should keep the progress on every device the player signs in on', async ({
    page,
    browser,
  }) => {
    const email = uniqueEmail('ada');
    const first = new BacteriaGamePo(page);
    await first.goto();
    await useDailyAttempt(first, page);
    // The guest becomes the Google account, progress and all.
    await (await openProfile(page)).signIn(email);

    const otherDevice = await browser.newContext();
    try {
      const page2 = await otherDevice.newPage();
      const second = new BacteriaGamePo(page2);
      await second.goto();
      const account = await openProfile(page2);
      await account.signIn(email, { existing: true });
      await second.backCta.click();

      await expectAttemptsLeft(second, page2, 2);

      // A new guest starts from the start; the progress stays with Google.
      await (await openProfile(page2)).signOut();
      await second.backCta.click();
      await expectAttemptsLeft(second, page2, 3);
    } finally {
      await otherDevice.close();
    }
  });

  test('should take the progress this device kept before into the cloud', async ({
    page,
  }) => {
    // What the device kept in local storage before the game had the cloud:
    // set once, so a reload shows what the cloud keeps.
    await page.addInitScript(() => {
      if (sessionStorage.getItem('seeded') === null) {
        sessionStorage.setItem('seeded', 'yes');
        localStorage.setItem(
          'bacteria-game.progress',
          JSON.stringify({ medals: { hourglass: { hard: 'gold' } } })
        );
      }
    });
    const po = new BacteriaGamePo(page);
    await po.goto();

    const account = await openProfile(page);
    await expect(account.medallions).toContainText('1 of');

    await page.reload();

    await expect((await openProfile(page)).medallions).toContainText('1 of');
    expect(
      await page.evaluate(() => localStorage.getItem('bacteria-game.progress'))
    ).toBe('null');
  });
});
