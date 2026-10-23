import { expect as baseExpect, Browser, Page, test } from '@playwright/test';
import { BacteriaGamePo } from './pos/bacteria-game.po';

// Two browser contexts are two players, guests of the emulators (Auth,
// Firestore and the Realtime Database), who meet through the matchmaking,
// become friends and challenge each other - see ADR 0010. Chromium only,
// as online.spec.ts explains.
test.skip(
  ({ browserName }) => browserName !== 'chromium',
  'WebRTC between two headless contexts runs in Chromium'
);
test.use({
  launchOptions: { args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] },
});

const expect = baseExpect.configure({ timeout: 30_000 });

interface Player {
  page: Page;
  po: BacteriaGamePo;
}

/** A player with a name of their own, on the main menu. */
async function player(browser: Browser, name: string): Promise<Player> {
  // Clipboard access: an invitation link is copied where there is no
  // share sheet, as in a headless browser.
  const context = await browser.newContext({
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await context.newPage();
  const po = new BacteriaGamePo(page);
  await po.goto();
  await po.profileCta.click();
  const field = page.getByLabel('Name', { exact: true });
  await expect(field).toBeEnabled();
  await field.fill(name);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Saved.' })
  ).toBeVisible();
  await po.backCta.click();
  return { page, po };
}

/** On to the online lobby. */
async function lobby({ po }: Player): Promise<void> {
  await po.setUp('Online');
}

test('players meet by matchmaking, become friends and challenge each other', async ({
  browser,
}) => {
  test.setTimeout(240_000);
  // Each run has its own names: the queue and profiles outlive a test.
  const run = Date.now().toString(36).slice(-4);
  const ada = await player(browser, `Ada ${run}`);
  const bob = await player(browser, `Bob ${run}`);

  await lobby(ada);
  await ada.page.getByRole('button', { name: 'Find an opponent' }).click();
  await expect(ada.page.getByText('Looking for an opponent…')).toBeVisible();
  await lobby(bob);
  await bob.page.getByRole('button', { name: 'Find an opponent' }).click();

  // The newer player claims the older one and starts at once.
  for (const { po } of [ada, bob]) {
    await expect(po.pauseCta).toBeVisible();
  }
  await expect(
    ada.po.colonyNames.filter({ hasText: `Bob ${run}` })
  ).not.toHaveCount(0);
  await expect(
    bob.po.colonyNames.filter({ hasText: `Ada ${run}` })
  ).not.toHaveCount(0);

  await bob.po.pauseCta.click();
  await bob.po.quitCta.click();
  await expect(ada.po.winner).toContainText('Your opponent is gone');
  await ada.po.winner
    .getByRole('button', { name: `Add Bob ${run} as a friend` })
    .click();
  await expect(ada.po.winner).toContainText('Friend request sent.');

  // Bob accepts in his lobby.
  await expect(bob.po.playCta).toBeVisible();
  await lobby(bob);
  const request = bob.page
    .locator('feat-lazy-bac-game-friends .person')
    .filter({ hasText: `Ada ${run}` });
  await expect(request).toContainText('wants to be friends');
  await request.getByRole('button', { name: 'Accept' }).click();

  // Ada sees Bob online and challenges him; Bob takes it from the menu.
  await ada.po.winner.getByRole('button', { name: 'Main menu' }).click();
  await expect(ada.po.playCta).toBeVisible();
  // Escape backs out of a screen to the main menu.
  await bob.page.keyboard.press('Escape');
  await expect(bob.po.playCta).toBeVisible();
  await lobby(ada);
  const friend = ada.page
    .locator('feat-lazy-bac-game-friends .person')
    .filter({ hasText: `Bob ${run}` });
  await expect(friend).toContainText('Online');
  await friend.getByRole('button', { name: 'Challenge' }).click();
  await expect(
    ada.page.getByText(`Waiting for Bob ${run} to accept…`)
  ).toBeVisible();

  const challenge = bob.page
    .getByRole('alert')
    .filter({ hasText: 'challenges you' });
  await expect(challenge).toContainText(`Ada ${run}`);
  await challenge.getByRole('button', { name: 'Play' }).click();

  await expect(
    ada.page.locator('feat-lazy-bac-game-online-lobby')
  ).toContainText(`Connected to Bob ${run}`);
  await ada.po.startCta.click();
  for (const { po } of [ada, bob]) {
    await expect(po.pauseCta).toBeVisible();
  }
});

test('an invitation link makes two players friends', async ({ browser }) => {
  const run = Date.now().toString(36).slice(-4);
  const cyd = await player(browser, `Cyd ${run}`);
  const dee = await player(browser, `Dee ${run}`);

  // Friends have a screen of their own, beside the lobby.
  await cyd.po.friendsCta.click();
  await cyd.page.getByRole('button', { name: 'Invite a friend' }).click();
  await expect(cyd.page.getByText('Link copied')).toBeVisible();
  const link = await cyd.page.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(/#friend=[a-z2-9]{20}$/);

  // Opened fresh, as a link from a message is - not a hash change in place.
  await dee.page.goto('about:blank');
  await dee.page.goto(link);
  const offer = dee.page.getByRole('alert').filter({ hasText: 'as a friend?' });
  await expect(offer).toContainText(`Cyd ${run}`);
  await offer.getByRole('button', { name: 'Add friend' }).click();
  await expect(offer).toHaveCount(0);

  await dee.po.friendsCta.click();
  await expect(
    dee.page
      .locator('feat-lazy-bac-game-friends .person')
      .filter({ hasText: `Cyd ${run}` })
  ).toContainText('Online');
  await expect(
    cyd.page
      .locator('feat-lazy-bac-game-friends .person')
      .filter({ hasText: `Dee ${run}` })
  ).toContainText('Online');
});
