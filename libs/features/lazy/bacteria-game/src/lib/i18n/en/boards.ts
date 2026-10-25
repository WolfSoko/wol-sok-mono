/** The leaderboards (ADR 0012). */
export const boards = {
  /** The label of a player who shows no name in public. */
  anonymous: 'Anonymous #{tag}',
  title: 'Leaderboards',
  region: 'The leaderboards',
  noCloud:
    'Leaderboards need the online game, which this build of the game does not connect to.',
  tabs: {
    xp: 'Rank',
    online: 'Online',
    daily: 'Daily',
    endless: 'Endless',
  },
  /** What each board can and cannot promise - part of the screen, not fine print. */
  info: {
    xp: 'The server works the XP out from your stored progress, and it rises no faster than a human could earn it. It does not prove the matches happened: a modified game can claim XP up to that limit.',
    online:
      'A result counts when both devices reported it for a match of at least 30 seconds. It does not prove the match was played honestly: two players working together can report a made-up match, up to the daily caps.',
    daily:
      'The top 10 were played again by the server on the ranked setup and gave the same result. A human playing is not proven: a script passes too. Entries below are claims checked for plausibility only.',
    endless:
      'Every win of a run in the top 10 was played again by the server. A ranked match whose replay never arrives in time is a lost life. Runs below the top 10 are claims.',
  },
  beingChecked: 'Being checked',
  others: 'Everyone else',
  status: {
    verified: 'Verified',
    provisional: 'Provisional',
    stale: 'Older version',
    partial: 'Partly confirmed',
  },
  final: 'Final',
  empty: 'Nobody on this board yet.',
  more: 'Show more',
  failed: 'The board could not be loaded.',
  you: {
    pos: 'You: #{pos}',
    checking: 'You: #{pos}, being checked',
    notYet: 'Not on this board yet: {reason}',
    reasons: {
      none: 'no counted result yet',
      optedOut: 'you keep off the leaderboards (Profile)',
    },
    hidden: 'Your entry on this board is hidden.',
  },
  day: 'Day',
  today: 'Today',
  newBoard: 'New board in {hours} h {minutes} min',
  show: {
    xp: '{xp} XP',
    record: 'W {w} · L {l} · D {d}',
    winRate: '{rate} won',
    notReported: 'Not reported: {count}',
    won: 'Won in {time}',
    held: 'Held {time}',
    depth: { one: '{count} level · {time}', other: '{count} levels · {time}' },
  },
};
