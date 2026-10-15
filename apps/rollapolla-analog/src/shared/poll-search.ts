import { Poll } from './poll';

/** Lower case without accents, so "creme" finds "Crème". */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * The polls whose question or options contain every word of the search, in
 * their original order. An empty search matches all polls.
 */
export function searchPolls(polls: readonly Poll[], search: string): Poll[] {
  const words = normalize(search).split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [...polls];
  }
  return polls.filter((poll) => {
    const text = normalize([poll.question, ...poll.options].join(' '));
    return words.every((word) => text.includes(word));
  });
}

export type PollSort = 'hot' | 'new';

export function sortPolls(polls: readonly Poll[], sort: PollSort): Poll[] {
  return [...polls].sort((a, b) =>
    sort === 'hot'
      ? b.totalVotes - a.totalVotes ||
        b.createdAt.getTime() - a.createdAt.getTime()
      : b.createdAt.getTime() - a.createdAt.getTime()
  );
}
