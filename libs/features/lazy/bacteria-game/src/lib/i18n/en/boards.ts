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
  /** Ranked daily attempts and endless runs (ADR 0012). */
  ranked: {
    daily: 'Ranked attempt',
    endless: 'Ranked run',
    left: {
      daily: 'Ranked attempts left today: {left} of {total}.',
      endless: 'Ranked runs left today: {left} of {total}.',
    },
    setup:
      'A ranked match plays the ranked setup - the normal computer, no head start - and goes onto the leaderboard.',
    noPause: "A ranked match can't be paused: it must be finished in one go.",
    runLives:
      'Leaving a match of a ranked run ends the run here, and the leaderboard counts it as a lost life.',
    practice: 'Practice: your own setup, not on the leaderboards.',
    used: {
      daily:
        'The three ranked attempts of today are used. New ones at 00:00 UTC.',
      endless:
        'The five ranked runs of today are started. New ones at 00:00 UTC.',
    },
    blocked: {
      device:
        "Ranked play needs a graphics chip that passed the game's check (Settings, Screen).",
      banned: 'Ranked play is not available while your account is suspended.',
      signedOut: 'Ranked play needs you signed in.',
    },
    declaring: 'Declaring your ranked attempt…',
    result: {
      daily: 'Ranked attempt {n} of {total} · ranked setup',
      endless: 'Ranked run · match {match} · ranked setup',
      offline: 'Not ranked: offline when the match started',
      used: 'Not ranked: the three attempts of today are used',
      'runs-used': 'Not ranked: the five ranked runs of today are started',
      'run-dropped': 'This run is no longer ranked',
    },
  },
};
