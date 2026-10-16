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
});
