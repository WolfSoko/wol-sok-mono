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
  await po.setUpOnline();
  return { page, po };
}

function lobby(page: Page) {
  return page.locator('feat-lazy-bac-game-online-lobby');
}

/** Two devices connected over a code: the host opened, the guest joined. */
async function connectedPair(browser: Browser) {
  const host = await device(browser);
  const guest = await device(browser);

  await host.po.openMatch();
  const code = lobby(host.page).locator('.code');
  await expect(code).toHaveText(/^[A-Z2-9]{6}$/);
  await guest.page
    .getByLabel('Code from a friend')
    .fill((await code.textContent()) ?? '');
  await guest.page.getByRole('button', { name: 'Join' }).click();
  return { host, guest };
}

test('two devices play an online match, and the one left wins', async ({
  browser,
}) => {
  const { host, guest } = await connectedPair(browser);

  await expect(lobby(host.page)).toContainText(/Connected( to .+)? - you play/);
  await expect(lobby(guest.page)).toContainText(
    /Connected( to .+)? - you play/
  );
  // Only the host starts.
  await expect(guest.po.startCta).toHaveCount(0);
  await host.po.startCta.click();

  // Both run the match, each with its own colony as "You" and the other
  // under its player's name.
  for (const { po } of [host, guest]) {
    await expect(po.pauseCta).toBeVisible();
    await expect(
      po.colonyNames.filter({ hasText: /^\s*You\s*$/ })
    ).not.toHaveCount(0);
    await expect(
      po.colonyNames.filter({ hasText: /Player \d{4}/ })
    ).not.toHaveCount(0);
  }
  await host.page.waitForTimeout(2000);

  await guest.po.pauseCta.click();
  await guest.po.quitCta.click();

  await expect(host.po.winner).toContainText(
    'Your opponent is gone - the match is yours.'
  );
});

test('two devices share a room: the host picks the level, the guest sees it, before and after a match', async ({
  browser,
}, testInfo) => {
  // A whole match: Meltdown ends after a minute of match time.
  test.setTimeout(300_000);
  const { host, guest } = await connectedPair(browser);
  const shot = (page: Page, name: string) =>
    page.screenshot({ path: testInfo.outputPath(`${name}.png`) });

  for (const { po } of [host, guest]) {
    await expect(po.room.locator('.player')).toHaveCount(2);
    await expect(po.room.locator('.tally')).toHaveText(/0\s*:\s*0/);
  }
  await expect(guest.po.room).toContainText('is choosing the level');
  await expect(guest.po.room.locator('.picker')).toHaveCount(0);

  await host.po.pickRoomLevel('Meltdown');
  await expect(host.po.room.locator('.next-title')).toHaveText(/Meltdown/);
  await expect(guest.po.room.locator('.next-title')).toHaveText(/Meltdown/);
  await shot(host.page, 'room-host');
  await shot(guest.page, 'room-guest');

  await host.po.startCta.click();
  for (const { po } of [host, guest]) {
    await expect(po.pauseCta).toBeVisible();
  }

  // Both see the result with the room: one win counted, the host picks on.
  for (const { po } of [host, guest]) {
    await expect(po.winner).toBeVisible({ timeout: 240_000 });
    // One win counted - or none for a draw.
    await expect(po.room.locator('.tally')).toHaveText(
      /^\s*[01]\s*:\s*[01]\s*$/
    );
  }
  await expect(guest.po.room).toContainText('is choosing the level');
  await expect(guest.page.getByRole('button', { name: /^Play / })).toHaveCount(
    0
  );
  await host.po.pickRoomLevel('Petri Dish');
  await expect(guest.po.room.locator('.next-title')).toHaveText(/Petri Dish/);
  await expect(
    host.page.getByRole('button', { name: /Play .*Petri Dish/ })
  ).toBeVisible();
  await shot(host.page, 'result-host');
  await shot(guest.page, 'result-guest');
});
