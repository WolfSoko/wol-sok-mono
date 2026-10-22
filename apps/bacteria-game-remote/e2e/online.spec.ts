import { expect as baseExpect, Browser, Page, test } from '@playwright/test';
import { BacteriaGamePo } from './pos/bacteria-game.po';

// Two browser contexts are two devices: two guests of the emulators, who
// meet in a Firestore room and play over a WebRTC data channel on this
// machine. Chromium only - it is the one browser here that connects two
// headless contexts directly, once it shows its local addresses rather than
// mDNS names nobody resolves.
test.skip(
  ({ browserName }) => browserName !== 'chromium',
  'WebRTC between two headless contexts runs in Chromium'
);
test.use({
  launchOptions: { args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] },
});

// Opening a room waits for the guest account, Firestore and the ICE
// candidates: seconds on a busy agent.
const expect = baseExpect.configure({ timeout: 30_000 });

/** A device on the start of a new online game. */
async function device(
  browser: Browser
): Promise<{ page: Page; po: BacteriaGamePo }> {
  const page = await (await browser.newContext()).newPage();
  const po = new BacteriaGamePo(page);
  await po.goto();
  await po.setUp('Online');
  return { page, po };
}

function lobby(page: Page) {
  return page.locator('feat-lazy-bac-game-online-lobby');
}

test('two devices play an online match, and the one left wins', async ({
  browser,
}) => {
  const host = await device(browser);
  const guest = await device(browser);

  await host.page.getByRole('button', { name: 'Open a match' }).click();
  const code = lobby(host.page).locator('.code');
  await expect(code).toHaveText(/^[A-Z2-9]{6}$/);
  await guest.page
    .getByLabel('Code from a friend')
    .fill((await code.textContent()) ?? '');
  await guest.page.getByRole('button', { name: 'Join' }).click();

  await expect(lobby(host.page)).toContainText('Connected - you play');
  await expect(lobby(guest.page)).toContainText('Connected - you play');
  // Only the host starts.
  await expect(guest.po.startCta).toHaveCount(0);
  await host.po.startCta.click();

  // Both run the match, each with the other colony as its opponent.
  for (const { po } of [host, guest]) {
    await expect(po.pauseCta).toBeVisible();
    await expect(
      po.colonyNames.filter({ hasText: 'Opponent' })
    ).not.toHaveCount(0);
  }
  await host.page.waitForTimeout(2000);

  await guest.po.pauseCta.click();
  await guest.po.quitCta.click();

  await expect(host.po.winner).toContainText(
    'Your opponent is gone - the match is yours.'
  );
});
