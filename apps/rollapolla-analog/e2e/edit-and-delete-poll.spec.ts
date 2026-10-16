import { expect, test } from './fixture/home-page-hydrated.fixture';
import { PollPo } from './pos/poll.po';

test.describe('Edit and delete your own poll', () => {
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
