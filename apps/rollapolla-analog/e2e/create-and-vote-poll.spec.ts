import { expect, test } from './fixture/home-page-hydrated.fixture';
import { PollPo } from './pos/poll.po';

test.describe('Create and vote on a poll', () => {
  test('creates a poll, votes and shows the results', async ({
    page,
    homePage,
  }) => {
    await homePage.expectTitleVisible();
    const poll = new PollPo(page);
    const question = `Pizza or pasta? ${Math.random()}`;

    await poll.createPoll(question, ['Pizza', 'Pasta', 'Both']);
    await poll.expectPollPage(question);

    // the creator is asked to share the poll first
    await expect(page.getByTestId('poll-ready')).toBeVisible();
    await expect(page.getByTestId('share-whatsapp')).toHaveAttribute(
      'href',
      new RegExp(`^https://wa\\.me/\\?text=.*${encodeURIComponent(page.url())}`)
    );

    await poll.vote(2);

    await expect(page.getByTestId('poll-total-votes')).toHaveText('1 vote');
    await expect(poll.result(2)).toContainText('100% (1)');
    await expect(poll.result(0)).toContainText('0% (0)');
    await expect(page.getByTestId('vote-button')).toHaveCount(0);
  });

  test('creates a private poll, shared by its link', async ({
    page,
    homePage,
  }) => {
    await homePage.expectTitleVisible();
    const poll = new PollPo(page);
    const question = `Only for my team? ${Math.random()}`;

    await poll.createPoll(question, ['Yes', 'No'], 'private');
    await poll.expectPollPage(question);

    await expect(page.getByTestId('poll-private-badge')).toBeVisible();
    await expect(page.getByTestId('poll-share-private')).toContainText(
      'Only people with the link'
    );
    await expect(page.getByTestId('copy-link')).toBeVisible();
  });

  // In this file, not a new one: CI spreads e2e files over five Nx agents, and
  // two files on one agent clash over the dev server and the Auth emulator.
  test('editing resets the votes, deleting removes the poll', async ({
    page,
    homePage,
  }) => {
    await homePage.expectTitleVisible();
    const poll = new PollPo(page);
    const question = `Pizza or pasta? ${Math.random()}`;
    await poll.createPoll(question, ['Pizza', 'Pasta']);
    await poll.expectPollPage(question);
    await poll.vote(0);
    await expect(page.getByTestId('poll-total-votes')).toHaveText('1 vote');

    const edited = `Pizza, pasta or salad? ${Math.random()}`;
    await poll.edit(edited, 'Salad');

    await expect(page.getByTestId('poll-question')).toHaveText(edited);
    await expect(page.getByTestId('poll-total-votes')).toHaveText('0 votes');
    await poll.vote(2);
    await expect(poll.result(2)).toContainText('100% (1)');

    await poll.delete();

    // the dev server compiles the lazy "My polls" route on its first visit
    await expect(page).toHaveURL(/\/my-polls$/, { timeout: 15_000 });
    await expect(page.getByText(edited)).toHaveCount(0);
  });
});
