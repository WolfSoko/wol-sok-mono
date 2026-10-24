import { featuredPollDraft, FEATURED_POLLS } from './featured-polls';
import { Poll } from './poll';
import { searchPolls, sortPolls } from './poll-search';

function poll(
  id: string,
  question: string,
  options: string[],
  totalVotes = 0,
  createdAt = new Date('2026-10-01')
): Poll {
  return {
    ...featuredPollDraft(FEATURED_POLLS[0], createdAt),
    id,
    question,
    options,
    totalVotes,
  };
}

describe('searchPolls', () => {
  const polls = [
    poll('a', 'Pizza or pasta?', ['Pizza', 'Pasta']),
    poll('b', 'Best dessert?', ['Crème brûlée', 'Tiramisu']),
    poll('c', 'Where to go hiking?', ['Alps', 'Pyrenees']),
  ];

  it('finds polls by question and options, ignoring case and accents', () => {
    expect(searchPolls(polls, 'PIZZA').map(({ id }) => id)).toEqual(['a']);
    expect(searchPolls(polls, 'creme').map(({ id }) => id)).toEqual(['b']);
    expect(searchPolls(polls, 'alps').map(({ id }) => id)).toEqual(['c']);
  });

  it('needs every word, in any order', () => {
    expect(searchPolls(polls, 'pasta pizza').map(({ id }) => id)).toEqual([
      'a',
    ]);
    expect(searchPolls(polls, 'pizza alps')).toEqual([]);
  });

  it('keeps all polls for an empty search', () => {
    expect(searchPolls(polls, '   ')).toEqual(polls);
  });
});

describe('sortPolls', () => {
  const older = poll('older', 'Older?', ['a', 'b'], 5, new Date('2026-10-01'));
  const newer = poll('newer', 'Newer?', ['a', 'b'], 1, new Date('2026-10-10'));

  it('sorts by votes or by age', () => {
    expect(sortPolls([newer, older], 'hot')).toEqual([older, newer]);
    expect(sortPolls([older, newer], 'new')).toEqual([newer, older]);
  });
});
