import { expect, test } from './fixture/home-page-hydrated.fixture';
import { PollPo } from './pos/poll.po';

// Firestore is offline in e2e: lists come from the local cache once the SDK
// gives up on the backend, which takes up to ten seconds.
const OFFLINE_TIMEOUT = 20_000;

test.describe('Discover polls', () => {
  test('shows the classics on the home page', async ({ page, homePage }) => {
    await homePage.expectTitleVisible();

    const classic = page.getByTestId('featured-tabs-or-spaces');
    await classic.scrollIntoViewIfNeeded();
    await expect(classic).toContainText('Tabs or spaces?');
    await classic.click();

    await expect(page).toHaveURL(/\/poll\/featured-tabs-or-spaces$/);
    await expect(page.getByTestId('poll-question')).toHaveText(
      'Tabs or spaces?'
    );
  });

  test('finds a new poll in search and discusses it', async ({
    page,
    homePage,
  }) => {
    await homePage.expectTitleVisible();
    const poll = new PollPo(page);
    const marker = Math.random().toString(36).slice(2, 8);
    const question = `Team offsite city ${marker}?`;
    await poll.createPoll(question, ['Lisbon', 'Berlin']);
    await poll.expectPollPage(question);

    // the discussion loads once it scrolls into view
    await page.mouse.wheel(0, 2000);
    const chat = page.getByTestId('poll-chat');
    await chat.scrollIntoViewIfNeeded();
    const message = `Lisbon, for the weather ${marker}`;
    await expect(async () => {
      await chat.getByRole('textbox').fill(message);
      await chat.getByRole('button', { name: 'Send message' }).click();
      await expect(chat.getByTestId('messages-list')).toContainText(message, {
        timeout: 2000,
      });
    }).toPass({ timeout: OFFLINE_TIMEOUT });

    await page.getByTestId('browse-polls-link').click();
    await expect(page).toHaveURL(/\/polls$/);
    await page.getByTestId('poll-search-input').fill(marker);
    await expect(page.getByTestId('poll-search-results')).toContainText(
      question,
      { timeout: OFFLINE_TIMEOUT }
    );
    await expect(page).toHaveURL(new RegExp(`/polls\\?q=${marker}$`));
  });
});
