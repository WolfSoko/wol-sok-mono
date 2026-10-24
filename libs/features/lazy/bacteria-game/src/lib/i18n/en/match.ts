/**
 * The end of a match: the headline, the medallion, the XP, what it opened
 * and what to play next - plus the medallion, the rank and the offer of a
 * shared ghost run, which other screens show as well.
 */
export const match = {
  /** One line on how the match ended, for whoever reads it. */
  headline: {
    draw: 'It is a draw - both colonies wiped each other out!',
    ghostWins: 'The ghost wins - its run ate your colony!',
    ghostBeaten: 'You beat the ghost!',
    computerWins: 'The computer wins - your colony was eaten!',
    youWin: 'You win - the computer colony is gone!',
    playerWins: 'Congratulations! {name} wins the match!',
    /** A chapter's finale against a boss. */
    boss: {
      wins: 'The boss wins - your colony was eaten!',
      playerIsBoss: '{name} wins as the boss!',
      playerSurvived: '{name} survived the boss!',
      playerBeat: '{name} beat the boss!',
      youSurvived: 'You survived the boss - the chapter is yours!',
      youBeat: 'The boss is gone - the chapter is yours!',
    },
    /** A colony held the zone long enough. */
    hold: {
      ghost: 'The ghost held the zone!',
      youBeatGhost: 'You held the zone - and beat the ghost!',
      computer: 'The computer held the zone - it wins!',
      you: 'You held the zone - you win!',
      player: '{name} held the zone and wins!',
    },
    /** A colony ate up enough pellets first. */
    harvest: {
      ghost: 'The ghost ate up enough pellets first!',
      youBeatGhost: 'You ate up enough pellets first - and beat the ghost!',
      computer: 'The computer ate up enough pellets first - it wins!',
      you: 'You ate up enough pellets first - you win!',
      player: '{name} ate up enough pellets first and wins!',
    },
    /** The clock ended the match: the bigger colony won. */
    time: {
      draw: 'Time is up - and both colonies are the same size. A draw!',
      ghost: 'Time is up - the ghost has the bigger colony.',
      youBeatGhost: 'Time is up - you beat the ghost!',
      computer: 'Time is up - the computer has the bigger colony.',
      you: 'Time is up - your colony is the bigger one. You win!',
      player: 'Time is up - {name} has the bigger colony and wins!',
    },
    /** A match between two devices, by what ended it. */
    online: {
      forfeit: 'Your opponent is gone - the match is yours.',
      desync: 'The two devices fell out of step - the match is off.',
      opponent: {
        annihilation: 'Your opponent ate the other colony - they win.',
        time: 'Your opponent had the bigger colony when time ran out - they win.',
        hold: 'Your opponent held the zone - they win.',
        survive: 'Your opponent survived - they win.',
        harvest: 'Your opponent ate up enough pellets first - they win.',
        other: 'Your opponent won - they win.',
      },
      you: {
        annihilation: 'You ate the other colony - you win!',
        time: 'You had the bigger colony when time ran out - you win!',
        hold: 'You held the zone - you win!',
        survive: 'You survived - you win!',
        harvest: 'You ate up enough pellets first - you win!',
        other: 'You won - you win!',
      },
    },
  },
  /** What the match was part of, in a line. */
  run: {
    daily: 'Daily level · {attempt} · {streak}',
    attempt: 'attempt {attempt} of {total}',
    practice: 'practice',
    streak: { one: '{count}-day streak', other: '{count}-day streak' },
    endless: 'Endless run · {beaten} · {lives}',
    endlessOver: 'Endless run over · {beaten} · best {best}',
    beaten: { one: '{count} level beaten', other: '{count} levels beaten' },
    lives: { one: '{count} life left', other: '{count} lives left' },
  },
  medal: {
    none: 'No medallion this time',
    newBest: '{medal} medallion - a new best!',
    wonIn: 'Won in {time}',
    held: 'You hold {medal} on this level already.',
  },
  /** Between two players. */
  duel: {
    takesSeries: '{name} takes the series!',
  },
  xp: {
    total: '+{xp} XP',
    towards: 'XP towards {rank}',
    towardsTop: 'XP towards the top',
    rankUp: 'Rank up!',
    toNext: '{xp} XP to {rank}',
  },
  /** What the match opened. */
  news: {
    label: 'New this match',
    achievement: 'Achievement',
    unlocked: 'Unlocked',
  },
  friend: {
    add: 'Add {name} as a friend',
    sent: 'Friend request sent.',
    failed: 'The friend request did not go out - try again.',
  },
  /** Sharing the run just played, for a friend to fight as a ghost. */
  share: {
    button: 'Share your run',
    text: 'Beat my run on {level}!',
    linkFailed: 'The link to your run could not be made.',
    copied: 'Link copied - send it to a friend to fight your ghost.',
    copyFailed: 'The link could not be copied.',
    shareFailed: 'The link could not be shared.',
  },
  actions: {
    menu: 'Main menu',
    guestWaits: 'Your opponent starts the next match.',
    connectionGone: 'The connection to your opponent is gone.',
    newRun: 'New run',
    nextLevel: 'Next level',
    tryAgain: 'Try it again',
    chooseLevel: 'Choose a level',
    playAgain: 'Play again',
    fightAgain: 'Fight it again',
    fightGhost: 'Fight your ghost',
    next: 'Next: {level}',
  },
  /** A medallion's picture, for screen readers. */
  medallion: {
    withDifficulty: '{medal}, {difficulty}',
  },
  rank: {
    badge: 'Rank: {name}',
    of: 'Rank {number} of {count}',
    xp: '{xp} XP',
    toNext: '{xp} to {rank}',
    bar: 'XP to the next rank',
  },
  /** The offer of a run someone shared. */
  ghostChallenge: {
    title: 'A ghost challenge',
    // The level's name, in bold, sits between the two halves.
    before: 'Someone shared their run on',
    after: '. Their colony plays it again - can you beat it?',
    fight: 'Fight it',
    notNow: 'Not now',
  },
};
